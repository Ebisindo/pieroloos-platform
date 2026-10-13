import { PlatformPermission } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentPlatformActor } from "@/lib/auth/platform-access";
import {
  listPlatformAdministrators,
  recordPlatformAuditEvent,
  revokePlatformAdministrator,
  setPlatformAdministratorPermissions,
} from "@/lib/services/platform-admin-service";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { enforceRateLimit, PLATFORM_ADMIN_MUTATION_LIMIT } from "@/lib/http/rate-limit";

const permissionsSchema = z.array(z.nativeEnum(PlatformPermission)).max(5);
const MAX_ADMIN_BODY_BYTES = 8 * 1024;
const grantSchema = z.object({
  userId: z.string().min(1).max(128),
  permissions: permissionsSchema,
  reason: z.string().trim().min(8).max(500),
}).strict();

async function recordDeniedChange(actor: { userId: string; isSuperAdmin: boolean }, action: string, subjectId?: string, reason?: string) {
  await recordPlatformAuditEvent({
    actorUserId: actor.userId,
    actorRole: actor.isSuperAdmin ? "SUPER_ADMIN" : "ADMIN",
    action,
    subjectType: subjectId ? "USER" : undefined,
    subjectId,
    outcome: "DENIED",
    reason,
  });
}

async function checkMutationRequest(request: Request, userId: string) {
  if (hasInvalidRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  return enforceRateLimit(PLATFORM_ADMIN_MUTATION_LIMIT, userId);
}

async function readJsonBody(request: Request): Promise<
  { ok: true; body: unknown } | { ok: false; response: NextResponse }
> {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_ADMIN_BODY_BYTES) {
    return { ok: false, response: NextResponse.json({ error: "Request body is too large." }, { status: 413 }) };
  }
  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return { ok: false, response: NextResponse.json({ error: "Request body is unreadable." }, { status: 400 }) };
  }
  if (Buffer.byteLength(raw, "utf8") > MAX_ADMIN_BODY_BYTES) {
    return { ok: false, response: NextResponse.json({ error: "Request body is too large." }, { status: 413 }) };
  }
  try {
    return { ok: true, body: JSON.parse(raw) as unknown };
  } catch {
    return { ok: false, response: NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 }) };
  }
}

export async function GET() {
  const actor = await getCurrentPlatformActor();
  if (!actor) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!actor.isSuperAdmin && !actor.permissions.includes(PlatformPermission.ADMINS_READ)) {
    return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  }

  try {
    return NextResponse.json({ data: await listPlatformAdministrators(actor) });
  } catch {
    console.error("Unable to load platform administrators.");
    return NextResponse.json({ error: "Unable to load platform administrators." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const actor = await getCurrentPlatformActor();
  if (!actor) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const rejected = await checkMutationRequest(request, actor.userId);
  if (rejected) return rejected;
  if (!actor.isSuperAdmin) {
    await recordPlatformAuditEvent({
      actorUserId: actor.userId,
      actorRole: "ADMIN",
      action: "PLATFORM_ADMIN_GRANT_DENIED",
      outcome: "DENIED",
    });
    return NextResponse.json({ error: "Super Administrator access required." }, { status: 403 });
  }

  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const parsed = grantSchema.safeParse(body.body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed." }, { status: 422 });

  try {
    await setPlatformAdministratorPermissions(actor, parsed.data.userId, parsed.data.permissions, parsed.data.reason);
    return NextResponse.json({ data: { userId: parsed.data.userId } }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "ADMIN_TARGET_NOT_FOUND") {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }
    if (error instanceof Error && error.message === "ADMIN_TARGET_NOT_STAFF") {
      return NextResponse.json({ error: "Only an existing staff member can be assigned platform administrator access." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "DASHBOARD_PERMISSION_REQUIRED") {
      return NextResponse.json({ error: "Dashboard access is required for client-list or audit views in this dashboard." }, { status: 422 });
    }
    if (error instanceof Error && error.message === "CANNOT_MODIFY_SUPER_ADMIN") {
      await recordDeniedChange(actor, "PLATFORM_SUPER_ADMIN_CHANGE_DENIED", parsed.data.userId, parsed.data.reason);
      return NextResponse.json({ error: "The Super Administrator assignment cannot be modified here." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "SUPER_ADMIN_REQUIRED") {
      await recordDeniedChange(actor, "PLATFORM_ADMIN_GRANT_DENIED", parsed.data.userId, parsed.data.reason);
      return NextResponse.json({ error: "Super Administrator access required." }, { status: 403 });
    }
    console.error("Unable to set platform administrator permissions.");
    return NextResponse.json({ error: "Unable to update administrator permissions." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const actor = await getCurrentPlatformActor();
  if (!actor) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const rejected = await checkMutationRequest(request, actor.userId);
  if (rejected) return rejected;
  if (!actor.isSuperAdmin) {
    await recordPlatformAuditEvent({
      actorUserId: actor.userId,
      actorRole: "ADMIN",
      action: "PLATFORM_ADMIN_PERMISSION_CHANGE_DENIED",
      outcome: "DENIED",
    });
    return NextResponse.json({ error: "Super Administrator access required." }, { status: 403 });
  }

  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const parsed = z.object({
    userId: z.string().min(1).max(128),
    permissions: permissionsSchema,
    reason: z.string().trim().min(8).max(500),
  }).strict().safeParse(body.body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed." }, { status: 422 });

  try {
    await setPlatformAdministratorPermissions(actor, parsed.data.userId, parsed.data.permissions, parsed.data.reason);
    return NextResponse.json({ data: { userId: parsed.data.userId } });
  } catch (error) {
    if (error instanceof Error && error.message === "ADMIN_TARGET_NOT_FOUND") {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }
    if (error instanceof Error && error.message === "ADMIN_TARGET_NOT_STAFF") {
      return NextResponse.json({ error: "Only an existing staff member can be assigned platform administrator access." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "DASHBOARD_PERMISSION_REQUIRED") {
      return NextResponse.json({ error: "Dashboard access is required for client-list or audit views in this dashboard." }, { status: 422 });
    }
    if (error instanceof Error && error.message === "CANNOT_MODIFY_SUPER_ADMIN") {
      await recordDeniedChange(actor, "PLATFORM_SUPER_ADMIN_CHANGE_DENIED", parsed.data.userId, parsed.data.reason);
      return NextResponse.json({ error: "The Super Administrator assignment cannot be modified here." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "SUPER_ADMIN_REQUIRED") {
      await recordDeniedChange(actor, "PLATFORM_ADMIN_PERMISSION_CHANGE_DENIED", parsed.data.userId, parsed.data.reason);
      return NextResponse.json({ error: "Super Administrator access required." }, { status: 403 });
    }
    console.error("Unable to update platform administrator permissions.");
    return NextResponse.json({ error: "Unable to update administrator permissions." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const actor = await getCurrentPlatformActor();
  if (!actor) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const rejected = await checkMutationRequest(request, actor.userId);
  if (rejected) return rejected;
  if (!actor.isSuperAdmin) {
    await recordPlatformAuditEvent({
      actorUserId: actor.userId,
      actorRole: "ADMIN",
      action: "PLATFORM_ADMIN_REVOKE_DENIED",
      outcome: "DENIED",
    });
    return NextResponse.json({ error: "Super Administrator access required." }, { status: 403 });
  }

  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const parsed = z.object({
    userId: z.string().min(1).max(128),
    reason: z.string().trim().min(8).max(500),
  }).strict().safeParse(body.body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed." }, { status: 422 });

  try {
    await revokePlatformAdministrator(actor, parsed.data.userId, parsed.data.reason);
    return NextResponse.json({ data: { userId: parsed.data.userId, revoked: true } });
  } catch (error) {
    if (error instanceof Error && error.message === "ADMIN_TARGET_NOT_FOUND") {
      return NextResponse.json({ error: "Platform administrator not found." }, { status: 404 });
    }
    if (error instanceof Error && error.message === "SUPER_ADMIN_REQUIRED") {
      await recordDeniedChange(actor, "PLATFORM_ADMIN_REVOKE_DENIED", parsed.data.userId, parsed.data.reason);
      return NextResponse.json({ error: "Super Administrator access required." }, { status: 403 });
    }
    console.error("Unable to revoke platform administrator.");
    return NextResponse.json({ error: "Unable to revoke platform administrator." }, { status: 500 });
  }
}
