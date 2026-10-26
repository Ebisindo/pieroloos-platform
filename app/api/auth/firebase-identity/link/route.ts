import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentPlatformActor } from "@/lib/auth/platform-access";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { enforceRateLimit, PLATFORM_ADMIN_MUTATION_LIMIT } from "@/lib/http/rate-limit";
import { FirebaseIdentityLinkError, linkCurrentSuperAdminFirebaseIdentity } from "@/lib/services/firebase-identity-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  firebaseIdToken: z.string().min(100).max(12_000),
}).strict();
const MAX_BODY_BYTES = 16_000;

export async function POST(request: Request) {
  const actor = await getCurrentPlatformActor();
  if (!actor) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!actor.isSuperAdmin) return NextResponse.json({ error: "Super Administrator access required." }, { status: 403 });
  if (hasInvalidRequestOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });

  try {
    const limited = await enforceRateLimit(PLATFORM_ADMIN_MUTATION_LIMIT, `firebase-identity-link:${actor.userId}`);
    if (limited) return limited;
  } catch {
    return NextResponse.json({ error: "Authentication rate limiting is unavailable." }, { status: 503 });
  }

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BODY_BYTES) return NextResponse.json({ error: "Request body is too large." }, { status: 413 });
  let raw: string;
  try { raw = await request.text(); } catch { return NextResponse.json({ error: "Unreadable request body." }, { status: 400 }); }
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) return NextResponse.json({ error: "Request body is too large." }, { status: 413 });

  let body: unknown;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 }); }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "A Firebase MFA ID token is required." }, { status: 422 });

  try {
    const linked = await linkCurrentSuperAdminFirebaseIdentity({
      userId: actor.userId,
      firebaseIdToken: parsed.data.firebaseIdToken,
    });
    return NextResponse.json({
      data: {
        projectId: linked.projectId,
        firebaseUid: linked.firebaseUid,
        linkedAt: linked.linkedAt.toISOString(),
        auditEventId: linked.auditEventId,
      },
      message: "Firebase identity linked. Step-up mutations remain blocked until all release gates pass.",
    }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof FirebaseIdentityLinkError) {
      const status = {
        NOT_CONFIGURED: 503,
        SUPER_ADMIN_REQUIRED: 403,
        ALREADY_LINKED: 409,
        INVALID_FIREBASE_IDENTITY: 401,
      }[error.code];
      return NextResponse.json({
        error: {
          NOT_CONFIGURED: "Firebase identity provider is not configured.",
          SUPER_ADMIN_REQUIRED: "Super Administrator access required.",
          ALREADY_LINKED: "A Firebase identity is already linked or belongs to another local account.",
          INVALID_FIREBASE_IDENTITY: "The Firebase token did not prove a recent MFA sign-in.",
        }[error.code],
      }, { status, headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ error: "Unable to link Firebase identity." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
