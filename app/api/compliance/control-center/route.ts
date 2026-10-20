import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { prisma } from "@/lib/db/prisma";
import { buildComplianceControlSnapshot } from "@/lib/domain/compliance-control";
import { controlCenterQuerySchema } from "@/lib/validation/compliance-control";

export async function GET(request: Request) {
  const context = await getWorkspaceContext();
  if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!context.principal) return NextResponse.json({ error: "Select an active workspace." }, { status: 409 });
  if (!context.principal.permissions.includes("compliance:read")) {
    return NextResponse.json({ error: "Compliance access denied." }, { status: 403 });
  }

  const url = new URL(request.url);
  const parsed = controlCenterQuerySchema.safeParse(Object.fromEntries(url.searchParams));

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid control-center query", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const principal = context.principal;
  if (parsed.data.clientId) {
    const client = await prisma.client.findFirst({
      where: { id: parsed.data.clientId, workspaceId: principal.workspaceId },
      select: { id: true },
    });
    if (!client) return NextResponse.json({ error: "Client not found in the active workspace." }, { status: 404 });
  }

  const obligations = await prisma.complianceObligation.findMany({
    where: {
      workspaceId: principal.workspaceId,
      ...(parsed.data.clientId ? { clientId: parsed.data.clientId } : {}),
    },
    select: {
      id: true,
      clientId: true,
      title: true,
      status: true,
      dueAt: true,
      requiresEvidence: true,
      professionalReviewRequired: true,
      escalationLevel: true,
    },
    orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
  });
  const snapshot = buildComplianceControlSnapshot(obligations);
  const alerts = snapshot.alerts.filter((alert) => {
    const inWindow = alert.daysUntilDue === null || alert.daysUntilDue <= parsed.data.days;
    const matchesStatus = !parsed.data.status || alert.status === parsed.data.status;
    return inWindow && matchesStatus;
  });

  return NextResponse.json({
    data: {
      generatedAt: new Date().toISOString(),
      filters: parsed.data,
      snapshot: { ...snapshot, alerts },
    },
  });
}
