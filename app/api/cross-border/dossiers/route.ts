import { NextResponse } from "next/server";
import { withAuthorizedWorkspaceTransaction } from "@/lib/auth/authorized-workspace-transaction";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { prisma } from "@/lib/db/prisma";
import { createCrossBorderDossierSchema } from "@/lib/validation/cross-border";

export async function GET() {
  const context = await getWorkspaceContext();
  if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!context.principal) return NextResponse.json({ error: "Select an active workspace." }, { status: 409 });
  if (!context.principal.permissions.includes("compliance:read")) {
    return NextResponse.json({ error: "Cross-border dossier access denied." }, { status: 403 });
  }
  const dossiers = await prisma.crossBorderDossier.findMany({
    where: { workspaceId: context.principal.workspaceId },
    include: {
      client: { select: { id: true, name: true, organizationName: true } },
      originJurisdiction: { select: { id: true, name: true, country: true } },
      destinationJurisdiction: { select: { id: true, name: true, country: true } },
      controls: {
        include: {
          evidence: { include: { document: { select: { id: true, name: true } } } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ data: dossiers });
}

export async function POST(request: Request) {
  if (hasInvalidRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const context = await getWorkspaceContext();
  if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!context.principal) return NextResponse.json({ error: "Select an active workspace." }, { status: 409 });
  if (!context.principal.permissions.includes("compliance:write")) {
    return NextResponse.json({ error: "Cross-border dossier write permission required." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const parsed = createCrossBorderDossierSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid cross-border dossier.", issues: parsed.error.flatten() }, { status: 422 });
  }
  const principal = context.principal;
  const client = await prisma.client.findFirst({
    where: { id: parsed.data.clientId, workspaceId: principal.workspaceId },
    select: { id: true, businessProfile: { select: { id: true } } },
  });
  if (!client) return NextResponse.json({ error: "Client not found in the active workspace." }, { status: 404 });

  const jurisdictions = await prisma.jurisdiction.findMany({
    where: {
      id: { in: [parsed.data.originJurisdictionId, parsed.data.destinationJurisdictionId] },
      OR: [{ workspaceId: principal.workspaceId }, { workspaceId: null }],
    },
    select: { id: true },
  });
  if (jurisdictions.length !== 2) {
    return NextResponse.json({ error: "Both jurisdictions must be available to this workspace." }, { status: 422 });
  }

  if (parsed.data.marketEntryPlanId) {
    const linkedPlan = await prisma.marketEntryPlan.findFirst({
      where: {
        id: parsed.data.marketEntryPlanId,
        workspaceId: principal.workspaceId,
        businessProfileId: client.businessProfile?.id,
        targetJurisdictionId: parsed.data.destinationJurisdictionId,
      },
      select: { id: true },
    });
    if (!linkedPlan) {
      return NextResponse.json({ error: "The linked market-entry pathway must belong to this client and destination." }, { status: 422 });
    }
  }

  const dossier = await withAuthorizedWorkspaceTransaction(principal, "compliance:write", async (transaction) => {
    const created = await transaction.crossBorderDossier.create({
      data: {
        workspaceId: principal.workspaceId,
        clientId: client.id,
        marketEntryPlanId: parsed.data.marketEntryPlanId ?? null,
        originJurisdictionId: parsed.data.originJurisdictionId,
        destinationJurisdictionId: parsed.data.destinationJurisdictionId,
        counterpartyName: parsed.data.counterpartyName,
        counterpartyCountry: parsed.data.counterpartyCountry || null,
        activityDescription: parsed.data.activityDescription,
        currencyCode: parsed.data.currencyCode?.toUpperCase() ?? null,
        estimatedValue: parsed.data.estimatedValue,
        createdByUserId: principal.userId,
      },
    });
    await transaction.crossBorderDossierAuditEvent.create({
      data: {
        dossierId: created.id,
        workspaceId: principal.workspaceId,
        actorUserId: principal.userId,
        eventType: "DOSSIER_CREATED",
        details: {
          originJurisdictionId: created.originJurisdictionId,
          destinationJurisdictionId: created.destinationJurisdictionId,
          marketEntryPlanId: created.marketEntryPlanId,
        },
      },
    });
    return created;
  });
  return NextResponse.json({ data: dossier }, { status: 201 });
}
