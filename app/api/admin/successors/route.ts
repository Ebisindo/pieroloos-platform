import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentPlatformActor } from "@/lib/auth/platform-access";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { enforceRateLimit, PLATFORM_ADMIN_MUTATION_LIMIT } from "@/lib/http/rate-limit";
import {
  addSuccessor, confirmOwnerAlive, createContinuityAsset, listSuccessors, revokeSuccessor,
  saveRunbook, simulateHandover,
} from "@/lib/services/successor-continuity-service";

const permissionsSchema = z.object({
  canTransferOwnership: z.boolean(),
  canAccessSecrets: z.boolean(),
  canDeploy: z.boolean(),
  canAccessBilling: z.boolean(),
}).strict();
const createSchema = z.object({
  successorName: z.string().trim().min(2).max(120),
  successorEmail: z.string().trim().email().max(254),
  successorGithub: z.string().trim().max(39).optional().or(z.literal("")),
  relationship: z.string().trim().min(2).max(80),
  autoActivateAfterDays: z.union([z.literal(30), z.literal(60), z.literal(90)]),
  permissions: permissionsSchema,
  highPermissionVerificationNote: z.string().trim().max(1000).optional(),
}).strict();
const MAX_BODY_BYTES = 8 * 1024;

async function jsonBody(request: Request) {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BODY_BYTES) return { ok: false as const, response: NextResponse.json({ error: "Request body is too large." }, { status: 413 }) };
  let raw: string;
  try { raw = await request.text(); } catch {
    return { ok: false as const, response: NextResponse.json({ error: "Unreadable request body." }, { status: 400 }) };
  }
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) return { ok: false as const, response: NextResponse.json({ error: "Request body is too large." }, { status: 413 }) };
  try { return { ok: true as const, body: JSON.parse(raw) as unknown }; } catch {
    return { ok: false as const, response: NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 }) };
  }
}

async function guard(request?: Request) {
  const actor = await getCurrentPlatformActor();
  if (!actor) return { error: NextResponse.json({ error: "Authentication required." }, { status: 401 }) };
  if (!actor.isSuperAdmin) return { error: NextResponse.json({ error: "Super Administrator access required." }, { status: 403 }) };
  if (request) {
    if (hasInvalidRequestOrigin(request)) return { error: NextResponse.json({ error: "Invalid request origin." }, { status: 403 }) };
    const limited = await enforceRateLimit(PLATFORM_ADMIN_MUTATION_LIMIT, actor.userId);
    if (limited) return { error: limited };
  }
  // MFA/step-up is an explicit launch gate. The current NextAuth session does not
  // carry a verified, short-lived step-up timestamp; fail closed instead of pretending.
  if (request && process.env.CONTINUITY_STEP_UP_ENFORCED !== "true") {
    return { error: NextResponse.json({ error: "Continuity mutations are disabled until the identity provider's verified MFA/reauthentication signal is configured (CONTINUITY_STEP_UP_ENFORCED)." }, { status: 503 }) };
  }
  return { actor };
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
  const parsedBody = await jsonBody(request);
  if (!parsedBody.ok) return parsedBody.response;
  const parsed = createSchema.safeParse(parsedBody.body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid successor details.", issues: parsed.error.flatten() }, { status: 422 });
  try {
    const result = await addSuccessor(access.actor, parsed.data);
    const baseUrl = process.env.NEXTAUTH_URL || process.env.SITE_URL;
    // Never return an invitation token to the browser. Email delivery is required
    // before this invitation can be considered delivered; worker/email integration follows.
    return NextResponse.json({
      data: { ...result.successor, inviteUrlConfigured: Boolean(baseUrl), invitationDelivery: "NOT_CONFIGURED" },
      warning: "Invitation record created; delivery must be configured before contacting the successor.",
    }, { status: 201 });
  } catch (error) {
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
  const parsedBody = await jsonBody(request);
  if (!parsedBody.ok) return parsedBody.response;
  const parsed = z.object({ action: z.enum(["alive", "simulate", "revoke", "asset", "runbook"]), successorId: z.string().optional(), reason: z.string().trim().min(8).max(500).optional(), asset: z.object({
    assetType: z.string().trim().min(2).max(60), label: z.string().trim().min(2).max(160),
    recoveryLocation: z.string().trim().min(2).max(500), criticality: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]), notes: z.string().max(1000).optional(),
  }).optional(), runbook: z.object({ id: z.string().optional(), title: z.string().trim().min(2).max(160), content: z.string().trim().min(20).max(20000) }).optional() }).strict().safeParse(parsedBody.body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid action payload." }, { status: 422 });
  try {
    if (parsed.data.action === "alive") return NextResponse.json({ data: await confirmOwnerAlive(access.actor) });
    if (parsed.data.action === "simulate" && parsed.data.successorId) return NextResponse.json({ data: await simulateHandover(access.actor, parsed.data.successorId) });
    if (parsed.data.action === "revoke" && parsed.data.successorId && parsed.data.reason) return NextResponse.json({ data: await revokeSuccessor(access.actor, parsed.data.successorId, parsed.data.reason) });
    if (parsed.data.action === "asset" && parsed.data.asset) return NextResponse.json({ data: await createContinuityAsset(access.actor, parsed.data.asset) }, { status: 201 });
    if (parsed.data.action === "runbook" && parsed.data.runbook) return NextResponse.json({ data: await saveRunbook(access.actor, parsed.data.runbook) }, { status: 201 });
    return NextResponse.json({ error: "Required action fields are missing." }, { status: 422 });
  } catch (error) {
    if (error instanceof Error && error.message === "SUCCESSOR_NOT_FOUND") return NextResponse.json({ error: "Successor not found." }, { status: 404 });
    if (error instanceof Error && error.message === "ACTIVE_SUCCESSOR_REQUIRES_RECOVERY_REVIEW") return NextResponse.json({ error: "An active successor requires a separately evidenced recovery review; self-service revoke is blocked." }, { status: 409 });
    if (error instanceof Error && error.message === "RUNBOOK_NOT_FOUND") return NextResponse.json({ error: "Runbook not found." }, { status: 404 });
    return NextResponse.json({ error: "The continuity action could not be completed." }, { status: 500 });
  }
}
