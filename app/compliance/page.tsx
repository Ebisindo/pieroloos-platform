import { ComplianceControlCenter } from "@/components/compliance/ComplianceControlCenter";
import { ComplianceWorkflow } from "@/components/compliance/ComplianceWorkflow";
import { EscalationBanner } from "@/components/control-plane/EscalationBanner";
import { WorkspaceAccessState } from "@/components/auth/WorkspaceAccessState";
import { ModuleBanner } from "@/components/ui/ModuleBanner";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { buildComplianceControlSnapshot } from "@/lib/domain/compliance-control";
import { prisma } from "@/lib/db/prisma";
import { listDocuments } from "@/lib/services/document-storage-service";
import { getRequestTranslator } from "@/lib/i18n/request";

export default async function CompliancePage() {
  const t = await getRequestTranslator();
  const context = await getWorkspaceContext();
  if (!context.userId) {
    return (
      <WorkspaceAccessState
        title={t("app.compliance.signInTitle")}
        description={t("app.compliance.signInDescription")}
        href="/signin?callbackUrl=/compliance"
        action={t("navigation.signIn")}
      />
    );
  }

  if (!context.principal || !context.activeWorkspace) {
    return (
      <WorkspaceAccessState
        title={t("app.compliance.workspaceRequired")}
        description={t("app.compliance.workspaceDescription")}
      />
    );
  }

  if (!context.principal.permissions.includes("compliance:read")) {
    return (
      <WorkspaceAccessState
        title={t("app.compliance.accessRequired")}
        description={t("app.compliance.accessDescription")}
      />
    );
  }

  const obligations = await prisma.complianceObligation.findMany({
    where: { workspaceId: context.principal.workspaceId },
    include: {
      client: { select: { id: true, name: true, organizationName: true, firstName: true, lastName: true } },
      evidence: {
        select: {
          id: true,
          documentId: true,
          evidenceClass: true,
          sourceReference: true,
          validThrough: true,
          reviewStatus: true,
          reviewNote: true,
        },
      },
    },
    orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
  });
  const snapshot = buildComplianceControlSnapshot(obligations);
  const [clients, documents, memberships] = await Promise.all([
    prisma.client.findMany({
      where: { workspaceId: context.principal.workspaceId },
      select: { id: true, name: true, organizationName: true, firstName: true, lastName: true },
      orderBy: { updatedAt: "desc" },
    }),
    listDocuments(context.principal),
    prisma.membership.findMany({
      where: { organizationId: context.principal.organizationId },
      select: { userId: true, user: { select: { name: true, email: true } } },
      orderBy: { user: { email: "asc" } },
    }),
  ]);

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      <ModuleBanner
        eyebrow={t("module.compliance")}
        title={t("module.compliance")}
        description={t("ui.banner.complianceDescription")}
        visual="compliance"
      />
      <div className="rounded-2xl border border-emerald-300/10 bg-emerald-300/[0.04] p-4 text-sm text-slate-300">
        {t("app.compliance.activeWorkspace", { name: context.activeWorkspace.name })}
      </div>
      <EscalationBanner />
      <ComplianceControlCenter snapshot={snapshot} />
      <ComplianceWorkflow
        obligations={obligations.map((obligation) => ({
          id: obligation.id,
          clientId: obligation.clientId,
          clientName: obligation.client.organizationName
            ?? obligation.client.name
            ?? [obligation.client.firstName, obligation.client.lastName].filter(Boolean).join(" "),
          title: obligation.title,
          type: obligation.type,
          status: obligation.status,
          ownerUserId: obligation.ownerUserId,
          dueAt: obligation.dueAt?.toISOString() ?? null,
          requiresEvidence: obligation.requiresEvidence,
          evidence: obligation.evidence.map((item) => ({
            id: item.id,
            documentId: item.documentId,
            evidenceClass: item.evidenceClass,
            sourceReference: item.sourceReference,
            validThrough: item.validThrough?.toISOString() ?? null,
            reviewStatus: item.reviewStatus,
            reviewNote: item.reviewNote,
          })),
        }))}
        clients={clients.map((client) => ({
          id: client.id,
          name: client.organizationName
            ?? client.name
            ?? [client.firstName, client.lastName].filter(Boolean).join(" "),
        }))}
        documents={documents.map((document) => ({
          id: document.id,
          name: document.name,
          clientId: document.clientId!,
        }))}
        teamMembers={memberships.map((membership) => ({
          userId: membership.userId,
          name: membership.user.name || membership.user.email,
        }))}
        canManage={context.principal.permissions.includes("compliance:write")}
        canReview={context.principal.permissions.includes("documents:review")}
      />
    </main>
  );
}
