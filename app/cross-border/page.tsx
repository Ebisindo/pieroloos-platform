import { WorkspaceAccessState } from "@/components/auth/WorkspaceAccessState";
import { CrossBorderDossierWorkflow } from "@/components/cross-border/CrossBorderDossierWorkflow";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { prisma } from "@/lib/db/prisma";

export default async function CrossBorderPage() {
  const context = await getWorkspaceContext();
  if (!context.userId) {
    return (
      <WorkspaceAccessState
        title="Sign in to prepare cross-border activity"
        description="Transaction preparation dossiers are available to authenticated workspace members."
        href="/signin?callbackUrl=/cross-border"
        action="Sign in"
      />
    );
  }
  if (!context.principal || !context.activeWorkspace) {
    return <WorkspaceAccessState title="Workspace selection required" description="Select a workspace to prepare cross-border activity." />;
  }
  if (!context.principal.permissions.includes("compliance:read")) {
    return <WorkspaceAccessState title="Cross-border preparation access required" description="Your role cannot view workspace transaction dossiers." />;
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
    prisma.document.findMany({
      where: { workspaceId, clientId: { not: null } },
      select: { id: true, name: true, clientId: true },
      orderBy: { createdAt: "desc" },
    }),
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
          <p className="eyebrow">INTERNATIONAL OPERATIONS</p>
          <h1>Cross-border preparation</h1>
          <p>Organize a transaction context, user-defined controls, linked evidence, and internal professional review.</p>
        </div>
        <span className="status-badge status-info">{context.activeWorkspace.name}</span>
      </header>
      <aside className="rounded-lg border border-amber-300/10 bg-amber-300/[0.035] p-5 text-sm leading-6 text-slate-400">
        These dossiers are internal preparation records. They do not execute payments, clear goods, assess sanctions or export controls, confirm counterparty standing, or replace advice from qualified professionals and authorities.
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
          label: `${plan.businessProfile.businessName || "Business"} · ${plan.targetJurisdiction.name}, ${plan.targetJurisdiction.country}`,
        }))}
        canManage={context.principal.permissions.includes("compliance:write")}
        canReview={context.principal.permissions.includes("documents:review")}
      />
    </div>
  );
}
