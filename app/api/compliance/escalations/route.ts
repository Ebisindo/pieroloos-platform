import { NextResponse } from "next/server";

export async function POST(request: Request) {
  void request;
  return NextResponse.json({ error: "Escalation policy persistence is not configured." }, { status: 501 });
}
