import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { prisma } from "@/lib/db/prisma";
import { createObligationSchema } from "@/lib/validation/compliance";

export async function GET() {
  const context = await getWorkspaceContext();
  if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!context.principal) return NextResponse.json({ error: "Select an active workspace." }, { status: 409 });
  if (!context.principal.permissions.includes("compliance:read")) {
    return NextResponse.json({ error: "Compliance access denied." }, { status: 403 });
  }

  const obligations = await prisma.complianceObligation.findMany({
    where: { workspaceId: context.principal.workspaceId },
    include: { client: { select: { id: true, name: true, organizationName: true } } },
    orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
  });
  return NextResponse.json({ data: obligations });
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const context = await getWorkspaceContext();
  if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!context.principal) return NextResponse.json({ error: "Select an active workspace." }, { status: 409 });
  if (!context.principal.permissions.includes("compliance:write")) {
    return NextResponse.json({ error: "Compliance write permission required." }, { status: 403 });
  }

  const parsed = createObligationSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid compliance obligation.", issues: parsed.error.flatten() }, { status: 422 });
  }

  const { principal } = context;
  const client = await prisma.client.findFirst({
    where: { id: parsed.data.clientId, workspaceId: principal.workspaceId },
    select: { id: true },
  });
  if (!client) return NextResponse.json({ error: "Client not found in the active workspace." }, { status: 404 });

  if (parsed.data.businessProfileId) {
    const profile = await prisma.businessProfile.findFirst({
      where: { id: parsed.data.businessProfileId, clientId: client.id },
      select: { id: true },
    });
    if (!profile) return NextResponse.json({ error: "Business profile does not belong to this client." }, { status: 422 });
  }

  if (parsed.data.formationPlanId) {
    const plan = await prisma.formationPlan.findFirst({
      where: { id: parsed.data.formationPlanId, workspaceId: principal.workspaceId, clientId: client.id },
      select: { id: true },
    });
    if (!plan) return NextResponse.json({ error: "Formation plan not found for this client." }, { status: 422 });
  }

  if (parsed.data.jurisdictionId) {
    const jurisdiction = await prisma.jurisdiction.findFirst({
      where: {
        id: parsed.data.jurisdictionId,
        OR: [{ workspaceId: principal.workspaceId }, { workspaceId: null }],
      },
      select: { id: true },
    });
    if (!jurisdiction) return NextResponse.json({ error: "Jurisdiction is not available in this workspace." }, { status: 422 });
  }

  const obligation = await prisma.$transaction(async (transaction) => {
    const created = await transaction.complianceObligation.create({
      data: {
        organizationId: principal.organizationId,
        workspaceId: principal.workspaceId,
        clientId: client.id,
        businessProfileId: parsed.data.businessProfileId,
        formationPlanId: parsed.data.formationPlanId,
        jurisdictionId: parsed.data.jurisdictionId,
        title: parsed.data.title,
        description: parsed.data.description,
        type: parsed.data.type,
        dueAt: parsed.data.dueAt,
        ownerUserId: principal.userId,
        requiresEvidence: parsed.data.requiresEvidence,
        professionalReviewRequired: parsed.data.professionalReviewRequired,
      },
    });
    await transaction.complianceActivity.create({
      data: { obligationId: created.id, action: "CREATED", actorUserId: principal.userId },
    });
    return created;
  });

  return NextResponse.json({ data: obligation }, { status: 201 });
}
