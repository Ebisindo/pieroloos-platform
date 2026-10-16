import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { withAuthorizedWorkspaceTransaction } from "@/lib/auth/authorized-workspace-transaction";
import { validateGraphEdge, wouldCreateOwnershipCycle } from "@/lib/domain/corporate-graph";
const schema = z.object({ fromNodeId:z.string().cuid(),toNodeId:z.string().cuid(),relation:z.enum(["OWNS","CONTROLS","SUBSIDIARY_OF","BRANCH_OF","BANKS_WITH","LICENSED_BY","TAX_REGISTERED_WITH","RELATED_TO"]),ownershipPercent:z.number().min(0).max(100).optional(),notes:z.string().trim().max(1000).optional() });
export async function POST(request: Request) {
 if (hasInvalidRequestOrigin(request)) return NextResponse.json({error:"Invalid request origin."},{status:403});
 const context=await getWorkspaceContext();
 if(!context.userId) return NextResponse.json({error:"Authentication required."},{status:401});
 if(!context.principal) return NextResponse.json({error:"Select an active workspace."},{status:409});
 if(!context.principal.permissions.includes("engagement:write")) return NextResponse.json({error:"Entity design permission required."},{status:403});
 const parsed=schema.safeParse(await request.json().catch(()=>null));
 if(!parsed.success) return NextResponse.json({error:"Validation failed.",issues:parsed.error.flatten()},{status:422});
 const invalid=validateGraphEdge(parsed.data);
 if(invalid) return NextResponse.json({error:invalid},{status:422});
 try {
  const principal=context.principal;
  const edge=await withAuthorizedWorkspaceTransaction(principal,"engagement:write",async tx=>{
   const nodes=await tx.corporateGraphNode.findMany({where:{organizationId:principal.organizationId,workspaceId:principal.workspaceId,id:{in:[parsed.data.fromNodeId,parsed.data.toNodeId]}},select:{id:true}});
   if(nodes.length!==2) throw new Error("GRAPH_NODE_NOT_FOUND");
   const existing=await tx.corporateGraphEdge.findMany({where:{organizationId:principal.organizationId,workspaceId:principal.workspaceId},select:{fromNodeId:true,toNodeId:true,relation:true},take:1000});
   if(wouldCreateOwnershipCycle(existing,parsed.data)) throw new Error("OWNERSHIP_CYCLE");
   return tx.corporateGraphEdge.create({data:{organizationId:principal.organizationId,workspaceId:principal.workspaceId,fromNodeId:parsed.data.fromNodeId,toNodeId:parsed.data.toNodeId,relation:parsed.data.relation,ownershipPercent:parsed.data.ownershipPercent===undefined?undefined:new Prisma.Decimal(parsed.data.ownershipPercent),notes:parsed.data.notes,createdByUserId:principal.userId},include:{fromNode:{select:{id:true,name:true}},toNode:{select:{id:true,name:true}}}});
  });
  return NextResponse.json({data:edge},{status:201});
 } catch(error) {
  if(error instanceof Error && error.message==="WORKSPACE_AUTHORIZATION_STALE") return NextResponse.json({error:"Workspace authorization changed. Refresh and try again."},{status:409});
  if(error instanceof Error && error.message==="GRAPH_NODE_NOT_FOUND") return NextResponse.json({error:"Both entities must belong to the active workspace."},{status:404});
  if(error instanceof Error && error.message==="OWNERSHIP_CYCLE") return NextResponse.json({error:"This relationship would introduce an ownership/control cycle."},{status:422});
  if(error instanceof Prisma.PrismaClientKnownRequestError && error.code==="P2002") return NextResponse.json({error:"This relationship already exists."},{status:409});
  console.error("Corporate graph relationship creation failed.",error);
  return NextResponse.json({error:"Unable to create graph relationship."},{status:500});
 }
}
