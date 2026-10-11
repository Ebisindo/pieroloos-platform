import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import {
  enforceRateLimit,
  PARTNERSHIP_INQUIRY_GLOBAL_LIMIT,
  PARTNERSHIP_INQUIRY_LIMIT,
} from "@/lib/http/rate-limit";
import { listPartnershipInquiries, submitPartnershipInquiry } from "@/lib/services/partnership-inquiry-service";
import { partnershipInquirySchema } from "@/lib/validation/partnership-inquiry";

const MAX_BODY_BYTES = 16 * 1024;

// Relies on the platform proxy to set x-forwarded-for; the per-IP limit is weaker where it is client-controlled.
function clientKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return createHash("sha256").update(forwarded).digest("hex").slice(0, 32);
}

export async function POST(request: Request) {
  if (hasInvalidRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const globalLimited = await enforceRateLimit(PARTNERSHIP_INQUIRY_GLOBAL_LIMIT, "all");
  if (globalLimited) return globalLimited;
  const limited = await enforceRateLimit(PARTNERSHIP_INQUIRY_LIMIT, clientKey(request));
  if (limited) return limited;

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Submission is too large." }, { status: 413 });
  }
  const raw = await request.text().catch(() => null);
  if (raw === null || raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Submission is too large or unreadable." }, { status: 413 });
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Submission must be valid JSON." }, { status: 400 });
  }

  const parsed = partnershipInquirySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }

  try {
    const result = await submitPartnershipInquiry(parsed.data);
    return NextResponse.json({ data: { id: result.id } }, { status: 201 });
  } catch {
    console.error("Unable to store partnership inquiry.");
    return NextResponse.json({ error: "Unable to submit your inquiry right now. Please try again later." }, { status: 500 });
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!session.user.isSuperAdmin) {
    return NextResponse.json({ error: "Platform administrator access required." }, { status: 403 });
  }
  try {
    return NextResponse.json({ data: await listPartnershipInquiries() });
  } catch {
    console.error("Unable to load partnership inquiries.");
    return NextResponse.json({ error: "Unable to load partnership inquiries." }, { status: 500 });
  }
}
