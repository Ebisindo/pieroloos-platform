import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/auth";
import { getCurrentPlatformActor } from "@/lib/auth/platform-access";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { enforceRateLimit, PLATFORM_ADMIN_MUTATION_LIMIT } from "@/lib/http/rate-limit";
import { FirebaseStepUpError } from "@/lib/auth/firebase-step-up";
import { beginFirebaseStepUpChallenge, isStepUpOperation } from "@/lib/services/firebase-step-up-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ operation: z.string().min(1).max(100) }).strict();

export async function POST(request: Request) {
  const session = await auth();
  const actor = await getCurrentPlatformActor();
  const sessionId = session?.stepUpSessionId;
  if (!actor || !session?.user?.id || session.user.id !== actor.userId || !actor.isSuperAdmin) {
    return NextResponse.json({ error: "Current Super Administrator session required." }, { status: 403 });
  }
  if (typeof sessionId !== "string" || sessionId.length < 20 || sessionId.length > 200) {
    return NextResponse.json({ error: "A valid signed session binding is required." }, { status: 401 });
  }
  if (hasInvalidRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const limited = await enforceRateLimit(PLATFORM_ADMIN_MUTATION_LIMIT, `firebase-step-up:${actor.userId}`);
  if (limited) return limited;

  let raw: string;
  try { raw = await request.text(); } catch {
    return NextResponse.json({ error: "Unreadable request body." }, { status: 400 });
  }
  if (Buffer.byteLength(raw, "utf8") > 2_000) {
    return NextResponse.json({ error: "Request body is too large." }, { status: 413 });
  }
  let body: unknown;
  try { body = JSON.parse(raw); } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success || !isStepUpOperation(parsed.data?.operation)) {
    return NextResponse.json({ error: "Invalid step-up operation." }, { status: 422 });
  }

  try {
    const challenge = await beginFirebaseStepUpChallenge({
      userId: actor.userId,
      sessionId,
      operation: parsed.data.operation,
    });
    return NextResponse.json({ data: challenge }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof FirebaseStepUpError && error.code === "NOT_CONFIGURED") {
      return NextResponse.json({ error: "Firebase step-up is not configured." }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ error: "Unable to establish a step-up challenge. Verify the staff Firebase UID has been linked." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
