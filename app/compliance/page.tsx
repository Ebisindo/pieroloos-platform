import { ComplianceControlCenter } from "@/components/compliance/ComplianceControlCenter";
import { ComplianceWorkflow } from "@/components/compliance/ComplianceWorkflow";
import { EscalationBanner } from "@/components/control-plane/EscalationBanner";
import { WorkspaceAccessState } from "@/components/auth/WorkspaceAccessState";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { buildComplianceControlSnapshot } from "@/lib/domain/compliance-control";
import { prisma } from "@/lib/db/prisma";

export default async function CompliancePage() {
  const context = await getWorkspaceContext();
  if (!context.userId) {
    return (
      <WorkspaceAccessState
        title="Sign in to view Compliance"
        description="Compliance obligations are available to authenticated workspace members."
        href="/signin?callbackUrl=/compliance"
        action="Sign in"
      />
    );
  }

  if (!context.principal || !context.activeWorkspace) {
    return (
      <WorkspaceAccessState
        title="Workspace selection required"
        description="Select an active workspace to view its compliance obligations."
      />
    );
  }

  if (!context.principal.permissions.includes("compliance:read")) {
    return (
      <WorkspaceAccessState
        title="Compliance access required"
        description="Your workspace role does not include permission to view compliance obligations."
      />
    );
  }

  const obligations = await prisma.complianceObligation.findMany({
    where: { workspaceId: context.principal.workspaceId },
    include: {
      client: { select: { id: true, name: true, organizationName: true, firstName: true, lastName: true } },
      evidence: { select: { id: true, documentId: true, evidenceClass: true } },
    },
    orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
  });
  const [clients, documents] = await Promise.all([prisma.client.findMany({
    where: { workspaceId: context.principal.workspaceId },
    select: { id: true, name: true, organizationName: true, firstName: true, lastName: true },
    orderBy: { createdAt: "desc" },
  }), prisma.document.findMany({
    where: { workspaceId: context.principal.workspaceId, clientId: { not: null } },
    select: { id: true, name: true, clientId: true },
    orderBy: { createdAt: "desc" },
  })]);
  const snapshot = buildComplianceControlSnapshot(obligations);

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="rounded-2xl border border-emerald-300/10 bg-emerald-300/[0.04] p-4 text-sm text-slate-300">
        Active workspace: <span className="font-medium text-white">{context.activeWorkspace.name}</span>
      </div>
      {obligations
        .filter((obligation) => obligation.escalationLevel > 0)
        .map((obligation) => (
          <EscalationBanner
            key={obligation.id}
            level={obligation.escalationLevel}
            message={obligation.title}
          />
        ))}
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
          dueAt: obligation.dueAt?.toISOString() ?? null,
          requiresEvidence: obligation.requiresEvidence,
          evidence: obligation.evidence.map((item) => ({
            id: item.id,
            documentId: item.documentId,
            evidenceClass: item.evidenceClass,
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
        canManage={context.principal.permissions.includes("compliance:write")}
        canReview={context.principal.permissions.includes("documents:review")}
      />
    </main>
  );
}
