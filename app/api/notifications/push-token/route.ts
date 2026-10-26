import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/auth";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

const tokenSchema = z.object({
  token: z.string().min(100).max(4096).refine((value) => !/\s/.test(value)),
  previousToken: z.string().min(100).max(4096).optional(),
}).strict();

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const context = await getWorkspaceContext();
  if (!context.principal || context.principal.userId !== userId) {
    return NextResponse.json({ error: "Select an authorized workspace first." }, { status: 403 });
  }

  let parsed: z.infer<typeof tokenSchema>;
  try {
    parsed = tokenSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid push-token request." }, { status: 400 });
  }

  try {
    const existing = await prisma.firebasePushToken.findUnique({ where: { token: parsed.token }, select: { userId: true } });
    if (existing && existing.userId !== userId) {
      return NextResponse.json({ error: "This browser token is already registered to another account." }, { status: 409 });
    }
    const activeCount = await prisma.firebasePushToken.count({ where: { userId, revokedAt: null } });
    const previousOwnedActive = parsed.previousToken
      ? await prisma.firebasePushToken.findFirst({
          where: { token: parsed.previousToken, userId, revokedAt: null },
          select: { id: true },
        })
      : null;
    if (!existing && activeCount >= 10 && !previousOwnedActive) {
      return NextResponse.json({ error: "This account has reached the active browser limit." }, { status: 429 });
    }
    await prisma.$transaction(async (tx) => {
      if (parsed.previousToken && parsed.previousToken !== parsed.token) {
        await tx.firebasePushToken.updateMany({
          where: { token: parsed.previousToken, userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      await tx.firebasePushToken.upsert({
        where: { token: parsed.token },
        create: { userId, token: parsed.token, lastSeenAt: new Date() },
        update: { lastSeenAt: new Date(), revokedAt: null },
      });
      await tx.notificationPreference.upsert({
        where: { workspaceId_userId: { workspaceId: context.principal!.workspaceId, userId } },
        create: { workspaceId: context.principal!.workspaceId, userId, pushEnabled: true },
        update: { pushEnabled: true },
      });
    });
    return NextResponse.json({ data: { registered: true } });
  } catch (error) {
    const errorCode = error instanceof Error && "code" in error ? String(error.code) : "UNKNOWN";
    if (errorCode === "P2002") {
      return NextResponse.json({ error: "This browser token is already registered to another account." }, { status: 409 });
    }
    console.error("Push token registration failed.", { errorCode });
    return NextResponse.json({ error: "Unable to register push notifications." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const context = await getWorkspaceContext();
  if (!context.principal || context.principal.userId !== userId) {
    return NextResponse.json({ error: "Select an authorized workspace first." }, { status: 403 });
  }

  let token: string;
  try {
    token = z.object({ token: z.string().min(100).max(4096).refine((value) => !/\s/.test(value)) }).strict().parse(await request.json()).token;
  } catch {
    return NextResponse.json({ error: "Invalid push-token request." }, { status: 400 });
  }
  try {
    await prisma.$transaction([
      prisma.firebasePushToken.updateMany({ where: { token, userId, revokedAt: null }, data: { revokedAt: new Date() } }),
      prisma.notificationPreference.updateMany({
        where: { workspaceId: context.principal.workspaceId, userId },
        data: { pushEnabled: false },
      }),
    ]);
    return NextResponse.json({ data: { revoked: true } });
  } catch {
    return NextResponse.json({ error: "Unable to revoke push notifications." }, { status: 500 });
  }
}
