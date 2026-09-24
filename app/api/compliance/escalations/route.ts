import { NextResponse } from "next/server";
import { escalationPolicySchema } from "@/lib/validation/compliance-control";

export async function POST(request: Request) {
  const parsed = escalationPolicySchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  return NextResponse.json(
    { data: { id: `policy:${crypto.randomUUID()}`, ...parsed.data } },
    { status: 201 },
  );
}
