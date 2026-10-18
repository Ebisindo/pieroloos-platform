import { BusinessIntentProposalWorkspace, type ProposalRecord } from "@/components/ai/BusinessIntentProposalWorkspace";
import { WorkspaceAccessState } from "@/components/auth/WorkspaceAccessState";
import { ModuleBanner } from "@/components/ui/ModuleBanner";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { prisma } from "@/lib/db/prisma";
import type { BusinessIntentProposal } from "@/lib/domain/business-intent-proposal";

type EvidenceReference = { id: string; statement: string; sourceUrl: string | null; evidenceClass: string; retrievedAt: string | null };
type ClientRecord = { id: string; organizationName: string | null; name: string | null; firstName: string | null; lastName: string | null };
function clientLabel(client: ClientRecord) {
  return client.organizationName ?? client.name ?? ([client.firstName, client.lastName].filter(Boolean).join(" ") || "Client");
}

export default async function BusinessIntentPage() {
  const context = await getWorkspaceContext();
  if (!context.userId) return <WorkspaceAccessState title="Sign-in required" description="Sign in to create and review workspace-scoped business-intent proposals." href="/signin?callbackUrl=/ai/business-intent" action="Sign in" />;
  if (!context.principal || !context.activeWorkspace) return <WorkspaceAccessState title="Active workspace required" description="Select an active workspace to access business-intent proposals." />;
  if (!context.principal.permissions.includes("formation:read")) return <WorkspaceAccessState title="Workspace access required" description="Your role cannot read business-intent proposals in this workspace." />;

  const principal = context.principal;
  const records = await prisma.businessIntentProposal.findMany({
    where: { organizationId: principal.organizationId, workspaceId: principal.workspaceId },
    select: {
      id: true, clientId: true, createdByUserId: true, reviewedByUserId: true, status: true, version: true,
      proposal: true, evidenceReferences: true, provider: true, providerModel: true, reviewNote: true,
      reviewedAt: true, createdAt: true, updatedAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  let linkedClients: ClientRecord[] = [];
  let clientOptions: ClientRecord[] = [];
  if (principal.permissions.includes("clients:read")) {
    const linkedIds = [...new Set(records.flatMap((record) => record.clientId ? [record.clientId] : []))];
    [linkedClients, clientOptions] = await Promise.all([
      linkedIds.length ? prisma.client.findMany({
        where: { id: { in: linkedIds }, workspaceId: principal.workspaceId },
        select: { id: true, organizationName: true, name: true, firstName: true, lastName: true },
      }) : Promise.resolve([]),
      prisma.client.findMany({
        where: { workspaceId: principal.workspaceId },
        select: { id: true, organizationName: true, name: true, firstName: true, lastName: true },
        orderBy: { updatedAt: "desc" },
        take: 100,
      }),
    ]);
  }
  const labelByClientId = new Map(linkedClients.map((client) => [client.id, clientLabel(client)]));
  const proposals: ProposalRecord[] = records.map((record) => ({
    ...record,
    clientName: record.clientId ? labelByClientId.get(record.clientId) ?? null : null,
    proposal: record.proposal as unknown as BusinessIntentProposal,
    evidenceReferences: Array.isArray(record.evidenceReferences) ? record.evidenceReferences as unknown as EvidenceReference[] : [],
    reviewedAt: record.reviewedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }));
  const clients = clientOptions.map((client) => ({ id: client.id, name: clientLabel(client) }));
  const canReview = principal.permissions.includes("formation:write") && ["owner", "admin", "advisor"].includes(principal.role);

  return <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
    <ModuleBanner eyebrow="BUSINESS INTENT / CONTROLLED PLANNING" title="Business intent and proposal review" description="Translate a business idea into a structured proposal, surface assumptions and evidence gaps, and record versioned human review before a later controlled step." visual="flow" />
    <div className="rounded-2xl border border-amber-200/15 bg-amber-100/[0.03] p-4 text-sm leading-6 text-amber-100/85">PieroloOS provides planning support, not legal, tax, accounting or financial advice. Approval is a recorded workflow decision only; it does not authorize incorporation, regulatory filing, payment, asset transfer or other external actions.</div>
    <BusinessIntentProposalWorkspace initialProposals={proposals} clients={clients} currentUserId={principal.userId} canCreate={principal.permissions.includes("formation:write")} canReview={canReview} workspaceName={context.activeWorkspace.name} />
  </main>;
}
