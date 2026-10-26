import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getCurrentPlatformActor, type PlatformActor } from "@/lib/auth/platform-access";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { enforceRateLimit, PLATFORM_ADMIN_MUTATION_LIMIT } from "@/lib/http/rate-limit";
import { prisma } from "@/lib/db/prisma";
import { getSessionBinding } from "@/lib/auth/session-binding";
import { consumeFirebaseStepUpChallenge, type StepUpOperation } from "@/lib/services/firebase-step-up-service";
import { FirebaseStepUpError } from "@/lib/auth/firebase-step-up";
import { addSuccessor, confirmOwnerAlive, createContinuityAsset, listSuccessors, revokeSuccessor, saveRunbook, simulateHandover } from "@/lib/services/successor-continuity-service";

const permissionsSchema = z.object({ canTransferOwnership: z.boolean(), canAccessSecrets: z.boolean(), canDeploy: z.boolean(), canAccessBilling: z.boolean() }).strict();
const stepUpHandleSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const createSchema = z.object({
  stepUpHandle: stepUpHandleSchema,
  successorName: z.string().trim().min(2).max(120), successorEmail: z.string().trim().email().max(254),
  successorGithub: z.string().trim().max(39).optional().or(z.literal("")), relationship: z.string().trim().min(2).max(80),
  autoActivateAfterDays: z.union([z.literal(30), z.literal(60), z.literal(90)]), permissions: permissionsSchema,
  highPermissionVerificationNote: z.string().trim().max(1000).optional(),
}).strict();
const MAX_BODY_BYTES = 8 * 1024;

async function jsonBody(request: Request) {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BODY_BYTES) return { ok: false as const, response: NextResponse.json({ error: "Request body is too large." }, { status: 413 }) };
  let raw: string;
  try { raw = await request.text(); } catch { return { ok: false as const, response: NextResponse.json({ error: "Unreadable request body." }, { status: 400 }) }; }
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) return { ok: false as const, response: NextResponse.json({ error: "Request body is too large." }, { status: 413 }) };
  try { return { ok: true as const, body: JSON.parse(raw) as unknown }; }
  catch { return { ok: false as const, response: NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 }) }; }
}

async function guard(request?: Request): Promise<{ error: NextResponse } | { actor: PlatformActor; sessionBinding?: string }> {
  const actor = await getCurrentPlatformActor();
  if (!actor) return { error: NextResponse.json({ error: "Authentication required." }, { status: 401 }) };
  if (!actor.isSuperAdmin) return { error: NextResponse.json({ error: "Super Administrator access required." }, { status: 403 }) };
  if (!request) return { actor };
  if (hasInvalidRequestOrigin(request)) return { error: NextResponse.json({ error: "Invalid request origin." }, { status: 403 }) };
  const limited = await enforceRateLimit(PLATFORM_ADMIN_MUTATION_LIMIT, actor.userId);
  if (limited) return { error: limited };
  const sessionBinding = getSessionBinding(request, actor.userId);
  if (!sessionBinding) return { error: NextResponse.json({ error: "A valid signed session cookie is required." }, { status: 401 }) };
  return { actor, sessionBinding };
}

async function withStepUp<T>(
  actor: { userId: string },
  sessionBinding: string,
  operation: StepUpOperation,
  handle: string,
  work: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  return prisma.$transaction(async (tx) => {
    await consumeFirebaseStepUpChallenge(tx, {
      userId: actor.userId,
      sessionId: sessionBinding,
      operation,
      handle,
    });
    return work(tx);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function GET() {
  const access = await guard();
  if ("error" in access) return access.error;
  try { return NextResponse.json({ data: await listSuccessors(access.actor) }); }
  catch { return NextResponse.json({ error: "Unable to load continuity records." }, { status: 500 }); }
}

export async function POST(request: Request) {
  const access = await guard(request);
  if ("error" in access) return access.error;
  const sessionBinding = access.sessionBinding;
  if (!sessionBinding) return NextResponse.json({ error: "A valid signed session cookie is required." }, { status: 401 });
  const parsedBody = await jsonBody(request);
  if (!parsedBody.ok) return parsedBody.response;
  const parsed = createSchema.safeParse(parsedBody.body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid successor details or missing step-up handle.", issues: parsed.error.flatten() }, { status: 422 });

  const origin = process.env.SITE_URL || process.env.NEXTAUTH_URL;
  let trustedOrigin: URL;
  try { if (!origin) throw new Error("missing"); trustedOrigin = new URL(origin); }
  catch { return NextResponse.json({ error: "Configure a valid SITE_URL or NEXTAUTH_URL before inviting a successor." }, { status: 503 }); }
  if (process.env.NODE_ENV === "production" && trustedOrigin.protocol !== "https:") return NextResponse.json({ error: "Production invitation origin must use HTTPS." }, { status: 503 });

  const membership = await prisma.membership.findFirst({
    where: { userId: access.actor.userId }, orderBy: { createdAt: "asc" },
    select: { organizationId: true, organization: { select: { workspaces: { orderBy: { createdAt: "asc" }, take: 1, select: { id: true } } } } },
  });
  const workspace = membership?.organization.workspaces[0];
  if (!membership || !workspace) return NextResponse.json({ error: "A workspace is required for secure invitation delivery." }, { status: 409 });

  try {
    const { stepUpHandle, ...successorInput } = parsed.data;
    const invite = await withStepUp(
      access.actor,
      sessionBinding,
      "continuity:create-successor",
      stepUpHandle,
      async (tx) => {
        const created = await addSuccessor(access.actor, successorInput, tx);
        const inviteUrl = new URL("/successor/accept", trustedOrigin);
        inviteUrl.searchParams.set("token", created.token);
        await tx.complianceNotification.create({
          data: {
            organizationId: membership.organizationId, workspaceId: workspace.id, channel: "EMAIL",
            subject: "PieroloOS successor invitation",
            body: `You have been nominated as a business continuity successor for PieroloOS. Review the invitation securely: ${inviteUrl.toString()}\n\nThis one-time link expires in seven days. Acceptance does not grant admin access or transfer ownership.\nInvitation recipient: ${created.successor.successorEmail}`,
            recipientUserId: null, scheduledFor: new Date(), dedupeKey: `successor-invite-${created.successor.id}`,
            templateKey: "legacy-notification", templateVersion: 1,
          },
        });
        return created;
      },
    );
    return NextResponse.json({ data: { ...invite.successor, invitationDelivery: "QUEUED" }, message: "Invitation queued for email delivery." }, { status: 201 });
  } catch (error) {
    if (error instanceof FirebaseStepUpError) {
      const status = error.code === "NOT_CONFIGURED" ? 503 : 401;
      return NextResponse.json({ error: status === 503 ? "Firebase step-up is not configured." : "The step-up handle is invalid, expired, replayed, or bound to another operation/session." }, { status });
    }
    if (error instanceof Error && error.message === "SUCCESSOR_ALREADY_EXISTS") return NextResponse.json({ error: "A non-revoked successor already uses this email." }, { status: 409 });
    if (error instanceof Error && error.message === "HIGH_PERMISSION_VERIFICATION_REQUIRED") return NextResponse.json({ error: "A documented video/ID verification plan is required for secret access." }, { status: 422 });
    if (error instanceof Error && error.message === "SUPER_ADMIN_REQUIRED") return NextResponse.json({ error: "Super Administrator access required." }, { status: 403 });
    if (error instanceof Error && error.message === "INVALID_PERMISSIONS") return NextResponse.json({ error: "Invalid permissions." }, { status: 422 });
    return NextResponse.json({ error: "Unable to create successor invitation." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const access = await guard(request);
  if ("error" in access) return access.error;
  const sessionBinding = access.sessionBinding;
  if (!sessionBinding) return NextResponse.json({ error: "A valid signed session cookie is required." }, { status: 401 });
  const parsedBody = await jsonBody(request);
  if (!parsedBody.ok) return parsedBody.response;
  const parsed = z.object({
    action: z.enum(["alive", "simulate", "revoke", "asset", "runbook"]),
    stepUpHandle: stepUpHandleSchema,
    successorId: z.string().optional(), reason: z.string().trim().min(8).max(500).optional(),
    asset: z.object({ assetType: z.string().trim().min(2).max(60), label: z.string().trim().min(2).max(160), recoveryLocation: z.string().trim().min(2).max(500), criticality: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]), notes: z.string().max(1000).optional() }).optional(),
    runbook: z.object({ id: z.string().optional(), title: z.string().trim().min(2).max(160), content: z.string().trim().min(20).max(20000) }).optional(),
  }).strict().safeParse(parsedBody.body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid action payload or missing step-up handle." }, { status: 422 });
  try {
    const stepUpOperationByAction: Record<typeof parsed.data.action, StepUpOperation> = {
      alive: "continuity:owner-alive",
      simulate: "continuity:simulate",
      revoke: "continuity:revoke",
      asset: "continuity:create-asset",
      runbook: "continuity:save-runbook",
    };
    const { stepUpHandle, ...actionInput } = parsed.data;
    if (actionInput.action === "alive") {
      return NextResponse.json({ data: await withStepUp(access.actor, sessionBinding, stepUpOperationByAction.alive, stepUpHandle, (tx) => confirmOwnerAlive(access.actor, tx)) });
    }
    if (actionInput.action === "simulate" && actionInput.successorId) {
      return NextResponse.json({ data: await withStepUp(access.actor, sessionBinding, stepUpOperationByAction.simulate, stepUpHandle, (tx) => simulateHandover(access.actor, actionInput.successorId!, tx)) });
    }
    if (actionInput.action === "revoke" && actionInput.successorId && actionInput.reason) {
      return NextResponse.json({ data: await withStepUp(access.actor, access.sessionBinding, stepUpOperationByAction.revoke, stepUpHandle, (tx) => revokeSuccessor(access.actor, actionInput.successorId!, actionInput.reason!, tx)) });
    }
    if (actionInput.action === "asset" && actionInput.asset) {
      return NextResponse.json({ data: await withStepUp(access.actor, access.sessionBinding, stepUpOperationByAction.asset, stepUpHandle, (tx) => createContinuityAsset(access.actor, actionInput.asset!, tx)) }, { status: 201 });
    }
    if (actionInput.action === "runbook" && actionInput.runbook) {
      return NextResponse.json({ data: await withStepUp(access.actor, access.sessionBinding, stepUpOperationByAction.runbook, stepUpHandle, (tx) => saveRunbook(access.actor, actionInput.runbook!, tx)) }, { status: 201 });
    }
    return NextResponse.json({ error: "Required action fields are missing." }, { status: 422 });
  } catch (error) {
    if (error instanceof FirebaseStepUpError) {
      const status = error.code === "NOT_CONFIGURED" ? 503 : 401;
      return NextResponse.json({ error: status === 503 ? "Firebase step-up is not configured." : "The step-up handle is invalid, expired, replayed, or bound to another operation/session." }, { status });
    }
    if (error instanceof Error && error.message === "SUCCESSOR_NOT_FOUND") return NextResponse.json({ error: "Successor not found." }, { status: 404 });
    if (error instanceof Error && error.message === "ACTIVE_SUCCESSOR_REQUIRES_RECOVERY_REVIEW") return NextResponse.json({ error: "An active successor requires an independently evidenced recovery review; self-service revoke is blocked." }, { status: 409 });
    if (error instanceof Error && error.message === "RUNBOOK_NOT_FOUND") return NextResponse.json({ error: "Runbook not found." }, { status: 404 });
    return NextResponse.json({ error: "The continuity action could not be completed." }, { status: 500 });
  }
}
