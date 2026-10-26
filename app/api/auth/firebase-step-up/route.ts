import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/auth";
import { createFirebaseStepUpChallenge, isStepUpOperation } from "@/lib/services/firebase-step-up-service";
import { enforceRateLimit, PLATFORM_ADMIN_MUTATION_LIMIT } from "@/lib/http/rate-limit";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { FirebaseStepUpError } from "@/lib/auth/firebase-step-up";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  operation: z.string().min(1).max(100),
  firebaseIdToken: z.string().min(100).max(12_000),
}).strict();


export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  const binding = session?.stepUpSessionId;
  if (!userId || typeof binding !== "string" || binding.length < 20 || binding.length > 200) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (hasInvalidRequestOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });

  const limit = await enforceRateLimit(PLATFORM_ADMIN_MUTATION_LIMIT, `firebase-step-up:${userId}`);
  if (limit) return limit;

  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 16_000) return NextResponse.json({ error: "Request body is too large." }, { status: 413 });
  let raw: string;
  try { raw = await request.text(); } catch { return NextResponse.json({ error: "Unreadable request body." }, { status: 400 }); }
  if (Buffer.byteLength(raw, "utf8") > 16_000) return NextResponse.json({ error: "Request body is too large." }, { status: 413 });
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success || !isStepUpOperation(parsed.data?.operation)) {
    return NextResponse.json({ error: "Invalid step-up request." }, { status: 422 });
  }

  try {
    const result = await createFirebaseStepUpChallenge({
      userId,
      sessionId: binding,
      operation: parsed.data.operation,
      firebaseIdToken: parsed.data.firebaseIdToken,
    });
    return NextResponse.json({ data: result }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof FirebaseStepUpError) {
      const status = error.code === "NOT_CONFIGURED" ? 503 : 401;
      return NextResponse.json({ error: status === 503 ? "Step-up provider is not configured." : "Recent Firebase MFA verification was not accepted." }, { status, headers: { "Cache-Control": "no-store" } });
    }
    // Do not log request bodies, bearer tokens, provider payloads, or untrusted error text.
    return NextResponse.json({ error: "Unable to establish step-up authorization." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
