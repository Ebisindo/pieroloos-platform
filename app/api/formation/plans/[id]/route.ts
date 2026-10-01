import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { prisma } from "@/lib/db/prisma";

type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, context: Context) {
  const workspaceContext = await getWorkspaceContext();
  if (!workspaceContext.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!workspaceContext.principal) return NextResponse.json({ error: "Select an active workspace." }, { status: 409 });
  if (!workspaceContext.principal.permissions.includes("formation:read")) {
    return NextResponse.json({ error: "Formation access denied." }, { status: 403 });
  }

  const { id } = await context.params;
  const plan = await prisma.formationPlan.findFirst({
    where: { id, workspaceId: workspaceContext.principal.workspaceId },
    include: {
      stages: {
        orderBy: { order: "asc" },
        include: {
          tasks: { orderBy: { order: "asc" }, include: { evidenceRequirements: true, reviews: true } },
        },
      },
      workingJurisdictionDecision: true,
    },
  });

  if (!plan) {
    return NextResponse.json({ error: "Formation plan not found." }, { status: 404 });
  }

  return NextResponse.json({ data: plan });
}
