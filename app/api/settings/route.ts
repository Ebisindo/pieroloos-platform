import { NextResponse } from "next/server";
import { withAuthorizedWorkspaceTransaction } from "@/lib/auth/authorized-workspace-transaction";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
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
    documentRetentionDays: settings.documentRetentionDays,
  }) : null;

  return NextResponse.json({ data: persistedSettings?.success ? persistedSettings.data : DEFAULT_WORKSPACE_SETTINGS });
}

export async function PATCH(request: Request) {
  if (hasInvalidRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const context = await getWorkspaceContext();
  if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!context.principal) return NextResponse.json({ error: "Select an active workspace." }, { status: 409 });
  if (!context.principal.permissions.includes("settings:manage")) {
    return NextResponse.json({ error: "Settings management permission required." }, { status: 403 });
  }
  const principal = context.principal;

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

  const settings = await withAuthorizedWorkspaceTransaction(principal, "settings:manage", async (transaction) => {
    const updatedSettings = await transaction.workspaceSettings.upsert({
      where: { workspaceId: principal.workspaceId },
      update: parsed.data,
      create: { workspaceId: principal.workspaceId, ...parsed.data },
    });
    await transaction.activity.create({
      data: {
        workspaceId: principal.workspaceId,
        actorId: principal.userId,
        type: "UPDATED",
        title: "Workspace settings updated",
        summary: "Workspace settings were updated by an authorized administrator.",
      },
    });
    return updatedSettings;
  });

  return NextResponse.json({ data: settings });
}