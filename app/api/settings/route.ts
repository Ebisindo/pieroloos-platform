import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { prisma } from "@/lib/db/prisma";
import {
  DEFAULT_WORKSPACE_SETTINGS,
  workspaceSettingsSchema,
} from "@/lib/validation/settings";

export async function GET() {
  const context = await getWorkspaceContext();
  if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!context.principal) return NextResponse.json({ error: "Select an active workspace." }, { status: 409 });
  if (!context.principal.permissions.includes("workspace:read")) {
    return NextResponse.json({ error: "Workspace access denied." }, { status: 403 });
  }

  const settings = await prisma.workspaceSettings.findUnique({
    where: { workspaceId: context.principal.workspaceId },
  });

  const persistedSettings = settings ? workspaceSettingsSchema.safeParse({
    timezone: settings.timezone,
    defaultLandingPage: settings.defaultLandingPage,
    complianceReminderDays: settings.complianceReminderDays,
    notificationsEnabled: settings.notificationsEnabled,
    complianceDueNotifications: settings.complianceDueNotifications,
    evidenceReviewNotifications: settings.evidenceReviewNotifications,
  }) : null;

  return NextResponse.json({ data: persistedSettings?.success ? persistedSettings.data : DEFAULT_WORKSPACE_SETTINGS });
}

export async function PATCH(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const context = await getWorkspaceContext();
  if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!context.principal) return NextResponse.json({ error: "Select an active workspace." }, { status: 409 });
  if (!context.principal.permissions.includes("settings:manage")) {
    return NextResponse.json({ error: "Settings management permission required." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = workspaceSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid settings.", issues: parsed.error.flatten() }, { status: 422 });
  }

  const settings = await prisma.workspaceSettings.upsert({
    where: { workspaceId: context.principal.workspaceId },
    update: parsed.data,
    create: { workspaceId: context.principal.workspaceId, ...parsed.data },
  });

  return NextResponse.json({ data: settings });
}