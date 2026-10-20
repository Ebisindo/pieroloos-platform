import { getRequestTranslator } from "@/lib/i18n/request";
import { WorkspaceAccessState } from "@/components/auth/WorkspaceAccessState";
import { CrossBorderDossierWorkflow } from "@/components/cross-border/CrossBorderDossierWorkflow";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { prisma } from "@/lib/db/prisma";
import { listDocuments } from "@/lib/services/document-storage-service";

export default async function CrossBorderPage() {
  const t = await getRequestTranslator();
  const context = await getWorkspaceContext();
  if (!context.userId) {
    return (
      <WorkspaceAccessState
        title={t("crossBorder.signInTitle")}
        description={t("crossBorder.signInDescription")}
        href="/signin?callbackUrl=/cross-border"
        action={t("access.signIn")}
      />
    );
  }
  if (!context.principal || !context.activeWorkspace) {
    return <WorkspaceAccessState title={t("access.workspaceRequired")} description={t("crossBorder.selectWorkspace")} />;
  }
  if (!context.principal.permissions.includes("compliance:read")) {
    return <WorkspaceAccessState title={t("crossBorder.accessTitle")} description={t("crossBorder.accessDescription")} />;
  }

  const workspaceId = context.principal.workspaceId;
  const [dossiers, clients, jurisdictions, documents, marketEntryPlans] = await Promise.all([
    prisma.crossBorderDossier.findMany({
      where: { workspaceId },
      include: {
        client: { select: { id: true, name: true, organizationName: true, firstName: true, lastName: true } },
        originJurisdiction: { select: { id: true, name: true, country: true } },
        destinationJurisdiction: { select: { id: true, name: true, country: true } },
        controls: {
          include: { evidence: { include: { document: { select: { id: true, name: true } } } } },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
    prisma.client.findMany({
      where: { workspaceId },
      select: { id: true, name: true, organizationName: true, firstName: true, lastName: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.jurisdiction.findMany({
      where: { OR: [{ workspaceId }, { workspaceId: null }] },
      select: { id: true, name: true, country: true },
      orderBy: { country: "asc" },
    }),
    listDocuments(context.principal, { requireClient: true }),
    prisma.marketEntryPlan.findMany({
      where: { workspaceId },
      select: {
        id: true,
        businessProfile: { select: { clientId: true, businessName: true } },
        targetJurisdiction: { select: { id: true, name: true, country: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">{t("crossBorder.eyebrow")}</p>
          <h1>{t("crossBorder.title")}</h1>
          <p>{t("crossBorder.description")}</p>
        </div>
        <span className="status-badge status-info">{context.activeWorkspace.name}</span>
      </header>
      <aside className="rounded-lg border border-amber-300/10 bg-amber-300/[0.035] p-5 text-sm leading-6 text-slate-400">
        {t("crossBorder.boundary")}
      </aside>
      <CrossBorderDossierWorkflow
        dossiers={dossiers.map((dossier) => ({
          ...dossier,
          estimatedValue: dossier.estimatedValue?.toString() ?? null,
          clientName: dossier.client.organizationName
            ?? dossier.client.name
            ?? [dossier.client.firstName, dossier.client.lastName].filter(Boolean).join(" "),
          origin: dossier.originJurisdiction,
          destination: dossier.destinationJurisdiction,
        }))}
        clients={clients.map((client) => ({
          id: client.id,
          name: client.organizationName ?? client.name ?? [client.firstName, client.lastName].filter(Boolean).join(" "),
        }))}
        jurisdictions={jurisdictions}
        documents={documents.map((document) => ({ ...document, clientId: document.clientId! }))}
        marketEntryPlans={marketEntryPlans.map((plan) => ({
          id: plan.id,
          clientId: plan.businessProfile.clientId,
          targetJurisdictionId: plan.targetJurisdiction.id,
          label: `${plan.businessProfile.businessName || t("crossBorder.businessFallback")} · ${plan.targetJurisdiction.name}, ${plan.targetJurisdiction.country}`,
        }))}
        canManage={context.principal.permissions.includes("compliance:write")}
        canReview={context.principal.permissions.includes("documents:review")}
      />
    </div>
  );
}
