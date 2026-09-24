import { NextResponse } from "next/server";
import { clientRepository } from "@/lib/db/client-repository";

type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, context: Context) {
  const { id } = await context.params;
  const client = await clientRepository.findById(id);

  if (!client) {
    return NextResponse.json({ error: "Client not found." }, { status: 404 });
  }

  return NextResponse.json({ data: client });
}

export async function PATCH(request: Request, context: Context) {
  const { id } = await context.params;

  try {
    const body = await request.json();
    const updated = await clientRepository.update(id, body);
    return NextResponse.json({ data: updated });
  } catch {
    return NextResponse.json({ error: "Unable to update client." }, { status: 400 });
  }
}
