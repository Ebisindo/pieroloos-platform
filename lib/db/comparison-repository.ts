import { prisma } from "@/lib/db/prisma";
export const comparisonRepository={
 create:(data:{businessProfileId?:string;methodologyVersion:string;criteriaJson:object;jurisdictionIds:string[];resultsJson:object})=>prisma.jurisdictionComparison.create({data:{businessProfileId:data.businessProfileId,methodologyVersion:data.methodologyVersion,criteriaJson:JSON.stringify(data.criteriaJson),jurisdictionIdsJson:JSON.stringify(data.jurisdictionIds),resultsJson:JSON.stringify(data.resultsJson)}}),
 findById:(id:string)=>prisma.jurisdictionComparison.findUnique({where:{id}}),
};
