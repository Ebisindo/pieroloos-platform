import { NextResponse } from "next/server";

export async function GET(request: Request) {
  void request;
  return NextResponse.json({ error: "Report evidence integration is not configured." }, { status: 501 });
}
