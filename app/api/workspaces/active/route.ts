import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth/auth-options";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
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
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const parsed = selectionSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid workspace selection." }, { status: 422 });

  const workspace = await prisma.workspace.findUnique({
    where: { id: parsed.data.workspaceId },
    select: { id: true, organizationId: true },
  });
  if (!workspace) return NextResponse.json({ error: "Workspace not found." }, { status: 404 });

  const membership = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId, organizationId: workspace.organizationId } },
    select: { id: true },
  });
  if (!membership) return NextResponse.json({ error: "Workspace access denied." }, { status: 403 });

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