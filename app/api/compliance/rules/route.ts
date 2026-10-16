import { NextResponse } from "next/server";
import { z } from "zod";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { prisma } from "@/lib/db/prisma";
import { assessComplianceRule } from "@/lib/domain/corporate-graph";
const querySchema=z.object({jurisdiction:z.string().trim().min(2).max(8).regex(/^[A-Za-z0-9-]+$/),entityType:z.string().trim().min(1).max(80)});
export async function GET(request:Request) {
 const context=await getWorkspaceContext();
 if(!context.userId) return NextResponse.json({error:"Authentication required."},{status:401});
 if(!context.principal) return NextResponse.json({error:"Select an active workspace."},{status:409});
 if(!context.principal.permissions.includes("compliance:read")) return NextResponse.json({error:"Compliance read permission required."},{status:403});
 const parsed=querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
 if(!parsed.success) return NextResponse.json({error:"Provide a jurisdiction and entityType.",issues:parsed.error.flatten()},{status:422});
 const rules=await prisma.corporateComplianceRule.findMany({where:{jurisdictionCode:parsed.data.jurisdiction.toUpperCase(),entityType:{equals:parsed.data.entityType,mode:"insensitive"},active:true,reviewStatus:{notIn:["REJECTED","SUPERSEDED"]}},orderBy:[{severity:"desc"},{title:"asc"}],take:100});
 return NextResponse.json({generatedAt:new Date().toISOString(),jurisdiction:parsed.data.jurisdiction.toUpperCase(),entityType:parsed.data.entityType,rules:rules.map(rule=>({...rule,assessment:assessComplianceRule(rule)})),notice:rules.length?"Rules are leads for structured review. They are not legal conclusions or a guarantee of compliance.":"No active rules are recorded for this jurisdiction/entity type. This does not mean no obligations exist."});
}
