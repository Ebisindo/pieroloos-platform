import { NextResponse } from "next/server";

export async function POST(request: Request) {
  void request;
  return NextResponse.json({ error: "Reminder scheduling is not configured." }, { status: 501 });
}
