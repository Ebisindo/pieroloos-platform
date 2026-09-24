import { NextResponse } from "next/server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Production: authenticate, authorize documents:read, load trusted storage key,
  // create a short-lived signed URL/stream, and append an audit event.
  return NextResponse.json({ error: "Document download adapter not connected", documentId: id }, { status: 501 });
}
