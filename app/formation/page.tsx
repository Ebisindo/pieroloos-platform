import { FormationPlanWorkflow } from "@/components/formation/FormationPlanWorkflow";
import { WorkspaceAccessState } from "@/components/auth/WorkspaceAccessState";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { prisma } from "@/lib/db/prisma";
import { listDocuments } from "@/lib/services/document-storage-service";
import { getRequestTranslator } from "@/lib/i18n/request";

function parseJurisdictionIds(value: string) {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export default async function FormationPage() {
  const t = await getRequestTranslator();
  const context = await getWorkspaceContext();
  if (!context.userId) {
    return (
      <WorkspaceAccessState
        title={t("signin.title")}
        description={t("app.formation.authRequired")}
        href="/signin?callbackUrl=/formation"
        action={t("navigation.signIn")}
      />
    );
  }
  if (!context.principal || !context.activeWorkspace) {
    return <WorkspaceAccessState title={t("navigation.workspace")} description={t("app.formation.workspaceRequired")} />;
  }
  if (!context.principal.permissions.includes("formation:read")) {
    return <WorkspaceAccessState title={t("app.formation.accessRequired")} description={t("app.formation.accessRequired")} />;
  }

  const workspaceId = context.principal.workspaceId;
  const [savedPlans, snapshots] = await Promise.all([
    prisma.formationPlan.findMany({
      where: { workspaceId },
      include: {
        client: { select: { id: true, name: true, organizationName: true, firstName: true, lastName: true } },
        stages: {
          orderBy: { order: "asc" },
          include: {
            tasks: {
              orderBy: { order: "asc" },
              include: { evidenceRequirements: true, reviews: true },
            },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.jurisdictionComparison.findMany({
      where: { workspaceId, businessProfileId: { not: null } },
      select: { id: true, businessProfileId: true, methodologyVersion: true, jurisdictionIdsJson: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);

  const profileIds = [...new Set(snapshots.flatMap((snapshot) => snapshot.businessProfileId ? [snapshot.businessProfileId] : []))];
  const profiles = await prisma.businessProfile.findMany({
    where: { id: { in: profileIds }, client: { workspaceId } },
    include: { client: { select: { id: true, name: true, organizationName: true, firstName: true, lastName: true } } },
  });
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const candidateIds = [...new Set(snapshots.flatMap((snapshot) => parseJurisdictionIds(snapshot.jurisdictionIdsJson)))];
  const jurisdictions = await prisma.jurisdiction.findMany({
    where: { id: { in: candidateIds }, OR: [{ workspaceId }, { workspaceId: null }] },
    select: { id: true, name: true },
  });
  const jurisdictionById = new Map(jurisdictions.map((jurisdiction) => [jurisdiction.id, jurisdiction]));
  const candidates = snapshots.flatMap((snapshot) => {
    const profile = snapshot.businessProfileId ? profileById.get(snapshot.businessProfileId) : undefined;
    if (!profile) return [];
    const client = profile.client;
    const clientName = client.organizationName
      ?? client.name
      ?? [client.firstName, client.lastName].filter(Boolean).join(" ")
      ?? "Client";
    const profileName = profile.businessName ?? clientName;
    return parseJurisdictionIds(snapshot.jurisdictionIdsJson).flatMap((jurisdictionId) => {
      const jurisdiction = jurisdictionById.get(jurisdictionId);
      if (!jurisdiction) return [];
      return [{
        comparisonSnapshotId: snapshot.id,
        jurisdictionId,
        jurisdictionName: jurisdiction.name,
        profileName,
        clientName,
        methodologyVersion: snapshot.methodologyVersion,
        comparedAt: snapshot.createdAt.toISOString(),
      }];
    });
  });

  const clientIds = [...new Set(savedPlans.map((plan) => plan.clientId))];
  const documents = context.principal.permissions.includes("documents:read") && clientIds.length
    ? await listDocuments(context.principal, { clientIds })
    : [];
  const documentsByClient = new Map<string, Array<{ id: string; name: string }>>();
  for (const document of documents) {
    if (!document.clientId) continue;
    const current = documentsByClient.get(document.clientId) ?? [];
    current.push({ id: document.id, name: document.name });
    documentsByClient.set(document.clientId, current);
  }

  const plans = savedPlans.map((plan) => ({
    id: plan.id,
    clientId: plan.clientId,
    clientName: plan.client.organizationName
      ?? plan.client.name
      ?? [plan.client.firstName, plan.client.lastName].filter(Boolean).join(" ")
      ?? "Client",
    jurisdictionName: plan.jurisdictionName,
    status: plan.status,
    updatedAt: plan.updatedAt.toISOString(),
    documents: documentsByClient.get(plan.clientId) ?? [],
    stages: plan.stages.map((stage) => ({
      key: stage.key,
      title: stage.title,
      description: stage.description,
      status: stage.status,
      tasks: stage.tasks.map((task) => ({
        id: task.id,
        key: task.key,
        title: task.title,
        description: task.description,
        status: task.status,
        requiresProfessionalReview: task.requiresProfessionalReview,
        reviewCompleted: task.reviews.some((review) => review.outcome === "APPROVED"),
        blockingReason: task.blockingReason,
        evidenceRequirements: task.evidenceRequirements.map((requirement) => ({
          id: requirement.id,
          key: requirement.key,
          label: requirement.label,
          required: requirement.required,
          satisfied: requirement.satisfied,
        })),
      })),
    })),
  }));

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">{t("navigation.formation")}</p>
          <h1>{t("module.formationRoadmap")}</h1>
          <p>{t("app.formation.pageDescription")}</p>
        </div>
        <span className="status-badge status-info">{context.activeWorkspace.name}</span>
      </header>
      <FormationPlanWorkflow
        plans={plans}
        candidates={candidates}
        canManage={context.principal.permissions.includes("formation:write")}
        canReview={context.principal.permissions.includes("documents:review")}
      />
      <aside className="rounded-lg border border-amber-300/10 bg-amber-300/[0.035] p-5 text-sm leading-6 text-slate-400">
        {t("app.formation.disclaimer")}
      </aside>
    </div>
  );
}
