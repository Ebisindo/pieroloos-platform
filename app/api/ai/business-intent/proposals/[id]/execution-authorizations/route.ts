import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { withAuthorizedWorkspaceTransaction } from "@/lib/auth/authorized-workspace-transaction";
import {
  digestExecutionOperation,
  executionAuthorizationExpiresAt,
  executionAuthorizationRequestSchema,
  type ExecutionAuthorizationRequest,
} from "@/lib/domain/execution-authorization";
import type { WorkspacePrincipal } from "@/lib/auth/workspace-access";

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
  if (parsed.data.operationType === "PRIVILEGE_CHANGE" && principal.role !== "owner") {
    return NextResponse.json({ error: "Only an owner may authorize a membership-role change." }, { status: 403 });
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

        await assertExecutionTargets(transaction, principal, proposal, parsed.data);

        const existing = await transaction.aIExecutionAuthorization.findUnique({
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

        const created = await transaction.aIExecutionAuthorization.create({
          data: {
            organizationId: principal.organizationId,
            workspaceId: principal.workspaceId,
            proposalId: proposal.id,
            proposalVersion: proposal.version,
            operationType: parsed.data.operationType,
            operationDigest,
            operationSnapshot: JSON.parse(JSON.stringify(parsed.data.operation)) as Prisma.InputJsonValue,
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
    if (error instanceof Error && error.message === "EXECUTION_TARGET_NOT_FOUND") {
      return NextResponse.json({ error: "The operation target is not active in the approved proposal's workspace and client scope." }, { status: 422 });
    }
    if (error instanceof Error && error.message === "EXECUTION_TARGET_SCOPE_MISMATCH") {
      return NextResponse.json({ error: "The operation client scope must exactly match the approved proposal's client scope." }, { status: 422 });
    }
    if (error instanceof Error && error.message === "EXECUTION_SELF_PRIVILEGE_CHANGE") {
      return NextResponse.json({ error: "An actor cannot authorize a privilege change targeting themselves." }, { status: 403 });
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
    if (typeof error === "object" && error !== null && "code" in error &&
      (error as { code?: unknown }).code === "P2002") {
      return NextResponse.json({ error: "A concurrent request claimed this idempotency key. Retry with the same key to retrieve the recorded authorization." }, { status: 409 });
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


async function assertExecutionTargets(
  transaction: Prisma.TransactionClient,
  principal: WorkspacePrincipal,
  proposal: { id: string; clientId: string | null },
  request: ExecutionAuthorizationRequest,
): Promise<void> {
  if (request.operationType === "CORPORATE_GRAPH_MUTATION") {
    const operation = request.operation;
    if (operation.clientId !== (proposal.clientId ?? undefined)) {
      throw new Error("EXECUTION_TARGET_SCOPE_MISMATCH");
    }
    if (operation.action === "CREATE_NODE") return;

    if (operation.action === "CREATE_RELATIONSHIP") {
      const nodes = await transaction.corporateGraphNode.findMany({
        where: {
          id: { in: operation.targetIds },
          organizationId: principal.organizationId,
          workspaceId: principal.workspaceId,
          clientId: proposal.clientId,
          archivedAt: null,
        },
        select: { id: true },
      });
      if (nodes.length !== operation.targetIds.length) throw new Error("EXECUTION_TARGET_NOT_FOUND");
      return;
    }

    if (operation.action === "ARCHIVE_RELATIONSHIP") {
      const edges = await transaction.corporateGraphEdge.findMany({
        where: {
          id: { in: operation.targetIds },
          organizationId: principal.organizationId,
          workspaceId: principal.workspaceId,
          archivedAt: null,
        },
        select: {
          id: true,
          fromNode: { select: { clientId: true } },
          toNode: { select: { clientId: true } },
        },
      });
      if (edges.length !== operation.targetIds.length ||
        edges.some((edge) => edge.fromNode.clientId !== proposal.clientId || edge.toNode.clientId !== proposal.clientId)) {
        throw new Error("EXECUTION_TARGET_NOT_FOUND");
      }
      return;
    }

    const nodes = await transaction.corporateGraphNode.findMany({
      where: {
        id: { in: operation.targetIds },
        organizationId: principal.organizationId,
        workspaceId: principal.workspaceId,
        clientId: proposal.clientId,
        archivedAt: null,
      },
      select: { id: true },
    });
    if (nodes.length !== operation.targetIds.length) throw new Error("EXECUTION_TARGET_NOT_FOUND");
    return;
  }

  if (request.operationType === "FILING_SUBMISSION") {
    const entity = await transaction.corporateGraphNode.findFirst({
      where: {
        id: request.operation.legalEntityId,
        organizationId: principal.organizationId,
        workspaceId: principal.workspaceId,
        clientId: proposal.clientId,
        nodeType: "COMPANY",
        archivedAt: null,
      },
      select: { id: true },
    });
    if (!entity) throw new Error("EXECUTION_TARGET_NOT_FOUND");
    return;
  }

  if (request.operationType === "PRIVILEGE_CHANGE") {
    if (request.operation.targetUserId === principal.userId) {
      throw new Error("EXECUTION_SELF_PRIVILEGE_CHANGE");
    }
    const target = await transaction.membership.findFirst({
      where: {
        userId: request.operation.targetUserId,
        organizationId: principal.organizationId,
      },
      select: { userId: true },
    });
    if (!target) throw new Error("EXECUTION_TARGET_NOT_FOUND");
  }
}
