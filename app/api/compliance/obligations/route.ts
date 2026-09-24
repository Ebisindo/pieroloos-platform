import { NextResponse } from "next/server";
import { createObligationSchema } from "@/lib/validation/compliance";

export async function POST(request: Request) {
  const parsed = createObligationSchema.safeParse(await request.json());
  if (!parsed.success)
    return NextResponse.json({error:"Invalid compliance obligation", issues:parsed.error.flatten()},{status:400});
  return NextResponse.json({data:{...parsed.data,status:"NOT_STARTED"}},{status:201});
}
