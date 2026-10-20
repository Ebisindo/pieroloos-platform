import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { withAuthorizedWorkspaceTransaction } from "@/lib/auth/authorized-workspace-transaction";

export async function GET() {
  const context = await getWorkspaceContext();
  if (!context.userId) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (!context.principal) {
    return NextResponse.json({ error: "Select an active workspace." }, { status: 409 });
  }
  if (!context.principal.permissions.includes("workspace:read")) {
    return NextResponse.json({ error: "Workspace read permission required." }, { status: 403 });
  }

  const principal = context.principal;
  try {
    const events = await withAuthorizedWorkspaceTransaction(principal, "workspace:read", (tx) =>
      tx.corporateGraphAuditEvent.findMany({
        where: { organizationId: principal.organizationId, workspaceId: principal.workspaceId },
        orderBy: { occurredAt: "desc" },
        take: 100,
        include: { actor: { select: { name: true } } },
      }),
    );
    return NextResponse.json({ events });
  } catch (error) {
    if (error instanceof Error && error.message === "WORKSPACE_AUTHORIZATION_STALE") {
      return NextResponse.json({ error: "Workspace authorization changed. Refresh and retry." }, { status: 409 });
    }
    console.error("Corporate graph audit read failed.");
    return NextResponse.json({ error: "Unable to read workspace graph activity." }, { status: 500 });
  }
}
