import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { recordDocumentScanResult } from "@/lib/services/document-storage-service";

const scanResultSchema = z.object({
  documentId: z.string().min(1),
  checksumSha256: z.string().regex(/^[a-f0-9]{64}$/i),
  result: z.enum(["CLEAN", "INFECTED", "FAILED"]),
  scanner: z.string().trim().min(1).max(120),
}).strict();

function hasValidWorkerSecret(request: Request) {
  const expected = process.env.DOCUMENT_SCANNER_WEBHOOK_SECRET;
  const authorization = request.headers.get("authorization");
  if (!expected || !authorization?.startsWith("Bearer ")) return false;
  const providedBuffer = Buffer.from(authorization.slice("Bearer ".length));
  const expectedBuffer = Buffer.from(expected);
  return providedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(providedBuffer, expectedBuffer);
}

export async function POST(request: Request) {
  if (!process.env.DOCUMENT_SCANNER_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Document scanner callback is not configured." }, { status: 503 });
  }
  if (!hasValidWorkerSecret(request)) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const parsed = scanResultSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid scan result." }, { status: 422 });

  try {
    const result = await recordDocumentScanResult(parsed.data);
    if (!result.checksumMatches) {
      return NextResponse.json({ error: "Scanner checksum does not match the stored document." }, { status: 422 });
    }
    return NextResponse.json({ data: result });
  } catch (error) {
    if (error instanceof Error && error.message === "DOCUMENT_NOT_FOUND") {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }
    console.error("Unable to record document scan result.", error);
    return NextResponse.json({ error: "Unable to record document scan result." }, { status: 500 });
  }
}
