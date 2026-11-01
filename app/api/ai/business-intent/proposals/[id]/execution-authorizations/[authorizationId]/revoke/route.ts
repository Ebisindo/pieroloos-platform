import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { withAuthorizedWorkspaceTransaction } from "@/lib/auth/authorized-workspace-transaction";

type RouteContext = { params: Promise<{ id: string; authorizationId: string }> };

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
    return NextResponse.json({ error: "Execution authorization revocation requires an owner, administrator or advisor." }, { status: 403 });
  }

  const { id: proposalId, authorizationId } = await routeContext.params;
  try {
    const result = await withAuthorizedWorkspaceTransaction(
      principal,
      "formation:write",
      async (transaction) => {
        const authorization = await transaction.aIExecutionAuthorization.findFirst({
          where: {
            id: authorizationId,
            proposalId,
            organizationId: principal.organizationId,
            workspaceId: principal.workspaceId,
          },
          select: {
            id: true,
            proposalId: true,
            proposalVersion: true,
            operationType: true,
            operationDigest: true,
            status: true,
            authorizedByUserId: true,
            expiresAt: true,
          },
        });
        if (!authorization) throw new Error("EXECUTION_AUTHORIZATION_NOT_FOUND");
        if (authorization.status !== "AUTHORIZED") {
          throw new Error("EXECUTION_AUTHORIZATION_NOT_ACTIVE");
        }

        const now = new Date();
        if (authorization.expiresAt <= now) {
          const expired = await transaction.aIExecutionAuthorization.updateMany({
            where: {
              id: authorization.id,
              workspaceId: principal.workspaceId,
              status: "AUTHORIZED",
              expiresAt: { lte: now },
            },
            data: { status: "EXPIRED" },
          });
          if (expired.count !== 1) throw new Error("EXECUTION_AUTHORIZATION_RACE");
          await transaction.activity.create({
              data: {
                workspaceId: principal.workspaceId,
                actorId: principal.userId,
                type: "UPDATED",
                title: "Execution authorization expired",
                summary: "An expired execution authorization was marked inactive before any execution.",
                metadata: {
                  authorizationId: authorization.id,
                  proposalId: authorization.proposalId,
                  proposalVersion: authorization.proposalVersion,
                  operationType: authorization.operationType,
                  operationDigest: authorization.operationDigest,
                  executionPerformed: false,
                },
              },
          });
          return { id: authorization.id, status: "EXPIRED" as const, revokedAt: now, expired: true };
        }

        const updated = await transaction.aIExecutionAuthorization.updateMany({
          where: {
            id: authorization.id,
            proposalId,
            organizationId: principal.organizationId,
            workspaceId: principal.workspaceId,
            status: "AUTHORIZED",
            expiresAt: { gt: now },
          },
          data: {
            status: "REVOKED",
            revokedAt: now,
          },
        });
        if (updated.count !== 1) throw new Error("EXECUTION_AUTHORIZATION_RACE");

        await transaction.activity.create({
          data: {
            workspaceId: principal.workspaceId,
            actorId: principal.userId,
            type: "UPDATED",
            title: "Execution authorization revoked",
            summary: "A time-limited authorization was revoked before execution. No external action was performed.",
            metadata: {
              authorizationId: authorization.id,
              proposalId: authorization.proposalId,
              proposalVersion: authorization.proposalVersion,
              operationType: authorization.operationType,
              operationDigest: authorization.operationDigest,
              authorizedByUserId: authorization.authorizedByUserId,
              revokedByUserId: principal.userId,
              revokedAt: now.toISOString(),
              executionPerformed: false,
            },
          },
        });

        return { id: authorization.id, status: "REVOKED" as const, revokedAt: now, expired: false };
      },
    );

    if (result.expired) {
      return NextResponse.json({ error: "Authorization expired and is no longer usable.", data: { id: result.id, status: result.status, executionPerformed: false } }, { status: 409 });
    }
    return NextResponse.json({ data: { id: result.id, status: result.status, revokedAt: result.revokedAt, executionPerformed: false } });
  } catch (error) {
    if (error instanceof Error && error.message === "WORKSPACE_AUTHORIZATION_STALE") {
      return NextResponse.json({ error: "Workspace authorization changed. Refresh and retry." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "EXECUTION_AUTHORIZATION_NOT_FOUND") {
      return NextResponse.json({ error: "Execution authorization not found in the active workspace." }, { status: 404 });
    }
    if (error instanceof Error && error.message === "EXECUTION_AUTHORIZATION_NOT_ACTIVE") {
      return NextResponse.json({ error: "Only an active authorization can be revoked." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "EXECUTION_AUTHORIZATION_RACE") {
      return NextResponse.json({ error: "Authorization state changed concurrently. Refresh and retry." }, { status: 409 });
    }
    console.error("Execution authorization revocation failed.", safeErrorCode(error));
    return NextResponse.json({ error: "Unable to revoke execution authorization." }, { status: 500 });
  }
}

function safeErrorCode(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error &&
    typeof (error as { code?: unknown }).code === "string") {
    return (error as { code: string }).code;
  }
  return error instanceof Error ? error.name : "unknown";
}
