import { NextResponse } from "next/server";
import { z } from "zod";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { withAuthorizedWorkspaceTransaction } from "@/lib/auth/authorized-workspace-transaction";
const schema = z.object({ name: z.string().trim().min(2).max(160), nodeType: z.enum(["COMPANY","PERSON","TRUST","PARTNERSHIP","BRANCH","BANKING_RELATIONSHIP","LICENSE","TAX_REGISTRATION","OTHER"]).default("COMPANY"), jurisdictionCode: z.string().trim().min(2).max(8).regex(/^[A-Za-z0-9-]+$/).optional(), entityType: z.string().trim().max(80).optional(), clientId: z.string().cuid().optional() });
export async function POST(request: Request) {
 if (hasInvalidRequestOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
 const context = await getWorkspaceContext();
 if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
 if (!context.principal) return NextResponse.json({ error: "Select an active workspace." }, { status: 409 });
 if (!context.principal.permissions.includes("engagement:write")) return NextResponse.json({ error: "Entity design permission required." }, { status: 403 });
 const parsed = schema.safeParse(await request.json().catch(() => null));
 if (!parsed.success) return NextResponse.json({ error: "Validation failed.", issues: parsed.error.flatten() }, { status: 422 });
 try {
  const principal = context.principal;
  const node = await withAuthorizedWorkspaceTransaction(principal,"engagement:write",async tx=>{
   if (parsed.data.clientId) {
    const client = await tx.client.findFirst({ where:{ id:parsed.data.clientId, organizationId:principal.organizationId, workspaceId:principal.workspaceId },select:{id:true} });
    if (!client) throw new Error("CLIENT_NOT_FOUND");
   }
   const node = await tx.corporateGraphNode.create({ data:{ organizationId:principal.organizationId,workspaceId:principal.workspaceId,clientId:parsed.data.clientId,name:parsed.data.name,nodeType:parsed.data.nodeType,jurisdictionCode:parsed.data.jurisdictionCode?.toUpperCase(),entityType:parsed.data.entityType,createdByUserId:principal.userId }});
   await tx.corporateGraphAuditEvent.create({ data: { organizationId: principal.organizationId, workspaceId: principal.workspaceId, actorUserId: principal.userId, action: "NODE_CREATED", subjectType: "CorporateGraphNode", subjectId: node.id, details: { name: node.name, nodeType: node.nodeType } } });
   return node;
  });
  return NextResponse.json({ data:node },{status:201});
 } catch(error) {
  if(error instanceof Error && error.message==="WORKSPACE_AUTHORIZATION_STALE") return NextResponse.json({error:"Workspace authorization changed. Refresh and try again."},{status:409});
  if(error instanceof Error && error.message==="CLIENT_NOT_FOUND") return NextResponse.json({error:"Client not found in the active workspace."},{status:404});
  console.error("Corporate graph node creation failed.",error);
  return NextResponse.json({error:"Unable to create graph entity."},{status:500});
 }
}
