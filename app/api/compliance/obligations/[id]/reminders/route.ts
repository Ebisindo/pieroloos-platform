import { NextResponse } from "next/server";
import { reminderSchema } from "@/lib/validation/compliance";

export async function POST(request: Request, context:{params:Promise<{id:string}>}) {
  const {id}=await context.params;
  const parsed=reminderSchema.safeParse(await request.json());
  if(!parsed.success) return NextResponse.json({error:parsed.error.flatten()},{status:400});
  return NextResponse.json({data:{obligationId:id,...parsed.data,status:"SCHEDULED"}},{status:201});
}
