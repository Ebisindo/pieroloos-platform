import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { withAuthorizedWorkspaceTransaction } from "@/lib/auth/authorized-workspace-transaction";
import {
  digestExecutionOperation,
  executionAuthorizationExpiresAt,
  executionAuthorizationRequestSchema,
} from "@/lib/domain/execution-authorization";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, routeContext: RouteContext) {
  if (hasInvalidRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const context = await getWorkspaceContext();
  if (!context.userId) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (!context.principal) {
    return NextResponse.json({ error: "Select an active workspace." }, { status: 409 });
  }
  const principal = context.principal;
  if (!principal.permissions.includes("formation:write")) {
    return NextResponse.json({ error: "Business formation write permission required." }, { status: 403 });
  }
  if (!["owner", "admin", "advisor"].includes(principal.role)) {
    return NextResponse.json({ error: "Execution authorization requires an owner, administrator or advisor." }, { status: 403 });
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (rawBody.length > 20_000) {
    return NextResponse.json({ error: "Request body is too large." }, { status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const parsed = executionAuthorizationRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({
      error: "A typed operation, exact-operation confirmation, expected proposal version and idempotency key are required.",
    }, { status: 422 });
  }

  const { id: proposalId } = await routeContext.params;
  const operationDigest = digestExecutionOperation(parsed.data.operationType, parsed.data.operation);
  const now = new Date();

  try {
    const result = await withAuthorizedWorkspaceTransaction(
      principal,
      "formation:write",
      async (transaction) => {
        const proposal = await transaction.businessIntentProposal.findFirst({
          where: {
            id: proposalId,
            organizationId: principal.organizationId,
            workspaceId: principal.workspaceId,
          },
          select: {
            id: true,
            clientId: true,
            createdByUserId: true,
            reviewedByUserId: true,
            status: true,
            version: true,
          },
        });

        if (!proposal) throw new Error("EXECUTION_PROPOSAL_NOT_FOUND");
        if (proposal.status !== "APPROVED" || !proposal.reviewedByUserId) {
          throw new Error("EXECUTION_PROPOSAL_NOT_APPROVED");
        }
        if (proposal.createdByUserId === proposal.reviewedByUserId) {
          throw new Error("EXECUTION_REVIEW_NOT_INDEPENDENT");
        }
        if (proposal.version !== parsed.data.expectedVersion) {
          throw new Error("EXECUTION_PROPOSAL_VERSION_CONFLICT");
        }

        const existing = await transaction.aiExecutionAuthorization.findUnique({
          where: {
            workspaceId_idempotencyKey: {
              workspaceId: principal.workspaceId,
              idempotencyKey: parsed.data.idempotencyKey,
            },
          },
        });

        if (existing) {
          const sameRequest = existing.proposalId === proposal.id &&
            existing.proposalVersion === proposal.version &&
            existing.operationType === parsed.data.operationType &&
            existing.operationDigest === operationDigest;
          if (!sameRequest) throw new Error("EXECUTION_IDEMPOTENCY_CONFLICT");
          if (existing.status !== "AUTHORIZED" || existing.expiresAt <= now) {
            throw new Error("EXECUTION_AUTHORIZATION_NOT_ACTIVE");
          }
          return { authorization: existing, replay: true };
        }

        const created = await transaction.aiExecutionAuthorization.create({
          data: {
            organizationId: principal.organizationId,
            workspaceId: principal.workspaceId,
            proposalId: proposal.id,
            proposalVersion: proposal.version,
            operationType: parsed.data.operationType,
            operationDigest,
            operationSnapshot: parsed.data.operation as unknown as Prisma.InputJsonValue,
            idempotencyKey: parsed.data.idempotencyKey,
            status: "AUTHORIZED",
            authorizedByUserId: principal.userId,
            authorizedAt: now,
            expiresAt: executionAuthorizationExpiresAt(now),
          },
        });

        await transaction.activity.create({
          data: {
            workspaceId: principal.workspaceId,
            actorId: principal.userId,
            type: "CREATED",
            title: "Execution authorization recorded",
            summary: "Separate, time-limited consent was recorded for an exact approved operation. No external action was executed.",
            metadata: {
              authorizationId: created.id,
              proposalId: proposal.id,
              proposalVersion: proposal.version,
              operationType: parsed.data.operationType,
              operationDigest,
              expiresAt: created.expiresAt.toISOString(),
              executionPerformed: false,
            },
          },
        });
        return { authorization: created, replay: false };
      },
    );

    return NextResponse.json({
      data: {
        id: result.authorization.id,
        proposalId: result.authorization.proposalId,
        proposalVersion: result.authorization.proposalVersion,
        operationType: result.authorization.operationType,
        operationDigest: result.authorization.operationDigest,
        status: result.authorization.status,
        authorizedAt: result.authorization.authorizedAt,
        expiresAt: result.authorization.expiresAt,
        replay: result.replay,
        executionPerformed: false,
      },
    }, { status: result.replay ? 200 : 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "WORKSPACE_AUTHORIZATION_STALE") {
      return NextResponse.json({ error: "Workspace authorization changed. Refresh and retry." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "EXECUTION_PROPOSAL_NOT_FOUND") {
      return NextResponse.json({ error: "Approved proposal not found in the active workspace." }, { status: 404 });
    }
    if (error instanceof Error && error.message === "EXECUTION_PROPOSAL_NOT_APPROVED") {
      return NextResponse.json({ error: "Proposal approval is required before separate execution consent can be recorded." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "EXECUTION_REVIEW_NOT_INDEPENDENT") {
      return NextResponse.json({ error: "The proposal must have an independent human review before execution consent." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "EXECUTION_PROPOSAL_VERSION_CONFLICT") {
      return NextResponse.json({ error: "Proposal version changed. Refresh and authorize the exact currently approved version." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "EXECUTION_IDEMPOTENCY_CONFLICT") {
      return NextResponse.json({ error: "This idempotency key is already bound to a different operation. Use a new key only for a new intentional authorization." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "EXECUTION_AUTHORIZATION_NOT_ACTIVE") {
      return NextResponse.json({ error: "The existing authorization is expired, revoked or consumed. Review and explicitly authorize again." }, { status: 409 });
    }
    if (typeof error === "object" && error !== null && "code" in error &&
      (error as { code?: unknown }).code === "P2034") {
      return NextResponse.json({ error: "Authorization state changed concurrently. Refresh and retry." }, { status: 409 });
    }
    console.error("Execution authorization failed.", safeErrorCode(error));
    return NextResponse.json({ error: "Unable to record execution authorization." }, { status: 500 });
  }
}

function safeErrorCode(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error &&
    typeof (error as { code?: unknown }).code === "string") {
    return (error as { code: string }).code;
  }
  return error instanceof Error ? error.name : "unknown";
}
