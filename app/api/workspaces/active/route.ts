import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuthorizedWorkspaceTransaction } from "@/lib/auth/authorized-workspace-transaction";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { permissionsForRole } from "@/lib/auth/workspace-access";
import { prisma } from "@/lib/db/prisma";

const selectionSchema = z.object({ workspaceId: z.string().min(1) }).strict();

export async function GET() {
  const context = await getWorkspaceContext();
  if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  return NextResponse.json({
    data: {
      activeWorkspaceId: context.activeWorkspace?.id ?? null,
      workspaces: context.workspaces,
    },
  });
}

export async function POST(request: Request) {
  if (hasInvalidRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const context = await getWorkspaceContext();
  const userId = context.userId;
  if (!userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const parsed = selectionSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid workspace selection." }, { status: 422 });

  const workspace = await prisma.workspace.findUnique({
    where: { id: parsed.data.workspaceId },
    select: { id: true, organizationId: true },
  });
  if (!workspace) return NextResponse.json({ error: "Workspace not found." }, { status: 404 });
  const accessibleWorkspace = context.workspaces.find((item) => item.id === workspace.id);
  if (!accessibleWorkspace) {
    return NextResponse.json({ error: "Workspace access denied." }, { status: 403 });
  }
  if (context.activeWorkspace?.id !== workspace.id) {
    const principal = {
      userId,
      organizationId: accessibleWorkspace.organizationId,
      workspaceId: accessibleWorkspace.id,
      role: accessibleWorkspace.role,
      permissions: permissionsForRole(accessibleWorkspace.role),
    };
    try {
      await withAuthorizedWorkspaceTransaction(principal, "workspace:read", (transaction) =>
        transaction.activity.create({
          data: {
            workspaceId: principal.workspaceId,
            actorId: principal.userId,
            type: "UPDATED",
            title: "Active workspace switched",
            summary: "The active workspace context was changed.",
            metadata: { previousWorkspaceId: context.activeWorkspace?.id ?? null },
          },
        }),
      );
    } catch (error) {
      if (error instanceof Error && error.message === "WORKSPACE_AUTHORIZATION_STALE") {
        return NextResponse.json({ error: "Workspace access changed. Refresh and try again." }, { status: 409 });
      }
      console.error("Unable to record workspace switch.", error);
      return NextResponse.json({ error: "Unable to switch workspace." }, { status: 500 });
    }
  }

  const response = NextResponse.json({ data: { activeWorkspaceId: workspace.id } });
  response.cookies.set("active-workspace", workspace.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}