import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { withAuthorizedWorkspaceTransaction } from "@/lib/auth/authorized-workspace-transaction";
export async function GET() {
 const context = await getWorkspaceContext();
 if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
 if (!context.principal) return NextResponse.json({ error: "Select an active workspace." }, { status: 409 });
 if (!context.principal.permissions.includes("workspace:read")) return NextResponse.json({ error: "Workspace read permission required." }, { status: 403 });
 const principal = context.principal;
 try {
  const data = await withAuthorizedWorkspaceTransaction(principal, "workspace:read", async (tx) => {
   const where = { organizationId: principal.organizationId, workspaceId: principal.workspaceId, archivedAt: null };
   const [nodes, edges] = await Promise.all([
    tx.corporateGraphNode.findMany({ where, orderBy: { createdAt: "asc" }, take: 250 }),
    tx.corporateGraphEdge.findMany({ where, include: { fromNode: { select: { name: true } }, toNode: { select: { name: true } } }, orderBy: { createdAt: "asc" }, take: 500 }),
   ]);
   return { nodes, edges };
  });
  return NextResponse.json(data);
 } catch (error) {
  if (error instanceof Error && error.message === "WORKSPACE_AUTHORIZATION_STALE") return NextResponse.json({ error: "Workspace authorization changed. Refresh and retry." }, { status: 409 });
  console.error("Corporate graph read failed.");
  return NextResponse.json({ error: "Unable to read the active workspace graph." }, { status: 500 });
 }
}
