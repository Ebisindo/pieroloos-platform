import { prisma } from "@/lib/db/prisma";
export const jurisdictionRepository={
 list:()=>prisma.jurisdiction.findMany({include:{factors:true,evidence:true},orderBy:{name:"asc"}}),
 findById:(id:string)=>prisma.jurisdiction.findUnique({where:{id},include:{factors:true,evidence:true}}),
 create:(data:{code:string;name:string;region?:string;profileSummary?:string})=>prisma.jurisdiction.create({data}),
};
