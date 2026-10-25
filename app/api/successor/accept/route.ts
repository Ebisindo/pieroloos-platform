import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { SuccessorStatus } from "@prisma/client";
import { getCurrentPlatformActor } from "@/lib/auth/platform-access";
import { prisma } from "@/lib/db/prisma";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { enforceRateLimit, PLATFORM_ADMIN_MUTATION_LIMIT } from "@/lib/http/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (hasInvalidRequestOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const actor = await getCurrentPlatformActor();
  if (!actor) return NextResponse.json({ error: "Sign in with an existing PieroloOS staff account to accept this invitation." }, { status: 401 });
  const limited = await enforceRateLimit(PLATFORM_ADMIN_MUTATION_LIMIT, `successor-invite-accept:${actor.userId}`);
  if (limited) return limited;

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || !("token" in body) || typeof body.token !== "string" || body.token.length < 32 || body.token.length > 128) {
    return NextResponse.json({ error: "A valid invitation token is required." }, { status: 422 });
  }
  const tokenHash = createHash("sha256").update(body.token).digest("hex");
  const successor = await prisma.successor.findUnique({ where: { inviteTokenHash: tokenHash } });
  if (!successor || successor.status !== SuccessorStatus.PENDING || !successor.inviteExpiresAt || successor.inviteExpiresAt <= new Date()) {
    return NextResponse.json({ error: "This invitation is invalid, expired, or already used." }, { status: 410 });
  }
  if (successor.successorEmail.toLowerCase() !== actor.email.toLowerCase()) {
    await prisma.platformAuditEvent.create({ data: {
      actorUserId: actor.userId, actorRole: actor.isSuperAdmin ? "SUPER_ADMIN" : "STAFF",
      action: "successor_acceptance_denied", subjectType: "SUCCESSOR", subjectId: successor.id,
      outcome: "DENIED", details: { reason: "EMAIL_MISMATCH" },
    } });
    return NextResponse.json({ error: "Sign in using the exact email address that received this invitation." }, { status: 403 });
  }

  // Acceptance binds to a matching authenticated identity. Current NextAuth integration
  // does not expose a trusted MFA/step-up assertion, so acceptance never grants a role.
  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    const claim = await tx.successor.updateMany({
      where: { id: successor.id, status: SuccessorStatus.PENDING, inviteTokenHash: tokenHash, inviteExpiresAt: { gt: now } },
      data: { status: SuccessorStatus.ACCEPTED, acceptedAt: now, inviteTokenHash: null, inviteExpiresAt: null },
    });
    if (!claim.count) return false;
    await tx.platformAuditEvent.create({ data: {
      actorUserId: actor.userId, actorRole: actor.isSuperAdmin ? "SUPER_ADMIN" : "STAFF",
      action: "successor_accepted", subjectType: "SUCCESSOR", subjectId: successor.id,
      outcome: "SUCCESS", details: { ownerId: successor.ownerId, emailMatched: true, adminAccessGranted: false, mfaVerified: false },
    } });
    return true;
  }, { isolationLevel: "Serializable" });
  if (!updated) return NextResponse.json({ error: "This invitation has already been used." }, { status: 409 });
  return NextResponse.json({
    data: { accepted: true, successorId: successor.id, verificationLevel: successor.verificationLevel, mfaVerified: false },
    nextStep: "Your email matched the invitation. An authorized reviewer must still record independent identity verification and MFA evidence. Acceptance alone grants no platform access.",
  });
}
