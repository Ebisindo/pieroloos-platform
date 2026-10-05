import { WorkspaceAccessState } from "@/components/auth/WorkspaceAccessState";
import { MarketEntryWorkflow } from "@/components/market-entry/MarketEntryWorkflow";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { prisma } from "@/lib/db/prisma";
import { marketReadinessResultSchema } from "@/lib/validation/market-entry";

function candidateIdsFromJson(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every((item) => typeof item === "string") ? parsed : [];
  } catch {
    return [];
  }
}

export default async function ExpansionPage() {
  const context = await getWorkspaceContext();
  if (!context.userId) {
    return (
      <WorkspaceAccessState
        title="Sign in to plan market expansion"
        description="Market-entry pathways are available to authenticated workspace members."
        href="/signin?callbackUrl=/expansion"
        action="Sign in"
      />
    );
  }
  if (!context.principal || !context.activeWorkspace) {
    return <WorkspaceAccessState title="Workspace selection required" description="Select a workspace to plan market expansion." />;
  }
  if (!context.principal.permissions.includes("jurisdictions:read")) {
    return <WorkspaceAccessState title="Market-entry access required" description="Your workspace role cannot view market-entry pathways." />;
  }

  const workspaceId = context.principal.workspaceId;
  const [savedComparisons, jurisdictions, savedFormationPlans, savedPlans] = await Promise.all([
    prisma.jurisdictionComparison.findMany({
      where: { workspaceId, businessProfileId: { not: null } },
      select: {
        id: true,
        businessProfileId: true,
        jurisdictionIdsJson: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.jurisdiction.findMany({
      where: { OR: [{ workspaceId }, { workspaceId: null }] },
      select: { id: true, name: true, country: true, countryCode: true },
    }),
    prisma.formationPlan.findMany({
      where: { workspaceId },
      select: { id: true, businessProfileId: true, jurisdictionId: true, status: true },
      orderBy: { updatedAt: "desc" },
      take: 200,
    }),
    prisma.marketEntryPlan.findMany({
      where: { workspaceId },
      include: {
        businessProfile: {
          select: {
            businessName: true,
            client: { select: { name: true, organizationName: true, firstName: true, lastName: true } },
          },
        },
        targetJurisdiction: { select: { id: true, name: true, country: true, countryCode: true } },
        formationPlan: { select: { id: true, status: true } },
        readinessAssessments: {
          orderBy: { assessedAt: "desc" },
          take: 1,
          select: { id: true, status: true, planVersion: true, resultJson: true, assessedAt: true },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
  ]);

  const profileIds = [...new Set(savedComparisons.flatMap((comparison) => comparison.businessProfileId ?? []))];
  const profiles = await prisma.businessProfile.findMany({
    where: { id: { in: profileIds }, client: { workspaceId } },
    select: {
      id: true,
      businessName: true,
      client: { select: { name: true, organizationName: true, firstName: true, lastName: true } },
    },
  });
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const jurisdictionById = new Map(jurisdictions.map((jurisdiction) => [jurisdiction.id, jurisdiction]));
  const comparisons = savedComparisons.flatMap((comparison) => {
    if (!comparison.businessProfileId) return [];
    const profile = profileById.get(comparison.businessProfileId);
    if (!profile) return [];
    const client = profile.client;
    const businessName = profile.businessName
      || client.organizationName
      || client.name
      || [client.firstName, client.lastName].filter(Boolean).join(" ")
      || "Business profile";
    const candidates = candidateIdsFromJson(comparison.jurisdictionIdsJson)
      .flatMap((id) => {
        const jurisdiction = jurisdictionById.get(id);
        return jurisdiction ? [jurisdiction] : [];
      });
    return candidates.length ? [{
      id: comparison.id,
      businessProfileId: comparison.businessProfileId,
      businessName,
      createdAt: comparison.createdAt.toISOString(),
      jurisdictions: candidates,
    }] : [];
  });

  const plans = savedPlans.map((plan) => {
    const assessment = plan.readinessAssessments[0];
    const parsedReadiness = assessment ? marketReadinessResultSchema.safeParse(assessment.resultJson) : null;
    return {
      ...plan,
      updatedAt: plan.updatedAt.toISOString(),
      readinessAssessments: assessment && parsedReadiness?.success
        ? [{
            id: assessment.id,
            status: parsedReadiness.data.status,
            planVersion: assessment.planVersion,
            resultJson: parsedReadiness.data,
            assessedAt: assessment.assessedAt.toISOString(),
          }]
        : [],
    };
  });

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">INTERNATIONAL EXPANSION</p>
          <h1>Market-entry pathways</h1>
          <p>Connect saved jurisdiction comparisons to formalization, recorded obligations, evidence coverage, and professional review.</p>
        </div>
        <span className="status-badge status-info">{context.activeWorkspace.name}</span>
      </header>
      <aside className="rounded-lg border border-amber-300/10 bg-amber-300/[0.035] p-5 text-sm leading-6 text-slate-400">
        This workspace tracks preparation and review. It does not determine market suitability or confirm legal, tax, regulatory, licensing, banking, or transaction readiness.
      </aside>
      <MarketEntryWorkflow
        comparisons={comparisons}
        formationPlans={savedFormationPlans}
        plans={plans}
        canManage={context.principal.permissions.includes("jurisdictions:write")}
        canLinkFormation={context.principal.permissions.includes("formation:write")}
        canReview={context.principal.permissions.includes("documents:review")}
      />
    </div>
  );
}
