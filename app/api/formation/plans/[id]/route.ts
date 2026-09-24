import { NextResponse } from "next/server";
import { formationRepository } from "@/lib/db/formation-repository";

type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, context: Context) {
  const { id } = await context.params;
  const plan = await formationRepository.getPlan(id);

  if (!plan) {
    return NextResponse.json({ error: "Formation plan not found." }, { status: 404 });
  }

  return NextResponse.json({ data: plan });
}
