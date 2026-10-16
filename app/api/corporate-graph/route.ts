import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { prisma } from "@/lib/db/prisma";
export async function GET() {
 const context = await getWorkspaceContext();
 if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
 if (!context.principal) return NextResponse.json({ error: "Select an active workspace." }, { status: 409 });
 if (!context.principal.permissions.includes("workspace:read")) return NextResponse.json({ error: "Workspace read permission required." }, { status: 403 });
 const where = { organizationId: context.principal.organizationId, workspaceId: context.principal.workspaceId };
 const [nodes, edges] = await Promise.all([
  prisma.corporateGraphNode.findMany({ where, orderBy: { createdAt: "asc" }, take: 250 }),
  prisma.corporateGraphEdge.findMany({ where, include: { fromNode: { select: { name: true } }, toNode: { select: { name: true } } }, orderBy: { createdAt: "asc" }, take: 500 }),
 ]);
 return NextResponse.json({ nodes, edges });
}
