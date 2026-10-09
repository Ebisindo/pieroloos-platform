import { NextResponse } from "next/server";
import { withAuthorizedWorkspaceTransaction } from "@/lib/auth/authorized-workspace-transaction";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { prisma } from "@/lib/db/prisma";
import { notificationPreferenceSchema } from "@/lib/validation/notification-preferences";

const defaultPreference = {
  inAppEnabled: true,
  emailEnabled: false,
  quietHoursStart: null,
  quietHoursEnd: null,
  timezone: "UTC",
};

export async function GET() {
  const context = await getWorkspaceContext();
  if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!context.principal) return NextResponse.json({ error: "Select an active workspace." }, { status: 409 });
  if (!context.principal.permissions.includes("compliance:read")) {
    return NextResponse.json({ error: "Workspace access denied." }, { status: 403 });
  }

  const preference = await prisma.notificationPreference.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: context.principal.workspaceId,
        userId: context.userId,
      },
    },
  });
  return NextResponse.json({ data: preference ?? defaultPreference });
}

export async function PATCH(request: Request) {
  if (hasInvalidRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const context = await getWorkspaceContext();
  if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!context.principal) return NextResponse.json({ error: "Select an active workspace." }, { status: 409 });
  const principal = context.principal;
  if (!principal.permissions.includes("compliance:read")) {
    return NextResponse.json({ error: "Workspace access denied." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = notificationPreferenceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid notification preferences.", issues: parsed.error.flatten() }, { status: 422 });
  }

  const preference = await withAuthorizedWorkspaceTransaction(principal, "compliance:read", (transaction) =>
    transaction.notificationPreference.upsert({
      where: {
        workspaceId_userId: {
          workspaceId: principal.workspaceId,
          userId: principal.userId,
        },
      },
      create: {
        workspaceId: principal.workspaceId,
        userId: principal.userId,
        ...parsed.data,
      },
      update: parsed.data,
    }),
  );
  return NextResponse.json({ data: preference });
}
