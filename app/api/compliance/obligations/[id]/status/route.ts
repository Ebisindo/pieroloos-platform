import { NextResponse } from "next/server";
import { updateComplianceStatusSchema } from "@/lib/validation/compliance";

export async function PATCH(request: Request, context:{params:Promise<{id:string}>}) {
  const {id}=await context.params;
  const parsed=updateComplianceStatusSchema.safeParse(await request.json());
  if(!parsed.success) return NextResponse.json({error:parsed.error.flatten()},{status:400});
  return NextResponse.json({data:{id,...parsed.data}});
}
