import { NextResponse } from "next/server";

export async function PATCH(request: Request) {
  void request;
  return NextResponse.json({ error: "Document review persistence is not configured." }, { status: 501 });
}
