import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { WorkspaceAccessState } from "@/components/auth/WorkspaceAccessState";
import { EvidenceBadge } from "@/components/jurisdiction/EvidenceBadge";
import { TrustBoundaryNotice } from "@/components/evidence/TrustBoundaryNotice";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { prisma } from "@/lib/db/prisma";
import type { EvidenceClass } from "@/lib/domain/jurisdiction";
import { formatDate } from "@/lib/i18n/messages";
import { getRequestLocale, getRequestTranslator } from "@/lib/i18n/request";

type PageProps = { params: Promise<{ id: string }> };

const evidenceClasses: Record<string, EvidenceClass> = {
  E0: "E0",
  E0_UNKNOWN: "E0",
  E1: "E1",
  E1_USER_PROVIDED: "E1",
  E2: "E2",
  E2_SECONDARY: "E2",
  E3: "E3",
  E3_PRIMARY: "E3",
  E4: "E4",
  E4_CROSS_VERIFIED: "E4",
};

function profileText(profile: unknown, key: string) {
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) return undefined;
  const value = (profile as Record<string, unknown>)[key];
  return typeof value === "string" ? value : undefined;
}

function displayValue(value: number | string | boolean | null, yesLabel: string, noLabel: string, unknownLabel: string) {
  if (value === null) return unknownLabel;
  if (typeof value === "boolean") return value ? yesLabel : noLabel;
  return String(value);
}

export default async function JurisdictionDetailPage({ params }: PageProps) {
  const [t, locale] = await Promise.all([getRequestTranslator(), getRequestLocale()]);
  const { id } = await params;
  const context = await getWorkspaceContext();
  if (!context.userId) redirect(`/signin?callbackUrl=${encodeURIComponent(`/jurisdictions/${id}`)}`);
  if (!context.activeWorkspace || !context.principal) {
    return <WorkspaceAccessState title={t("app.jurisdiction.selectWorkspace")} description={t("app.jurisdiction.description")} />;
  }
  if (!context.principal.permissions.includes("jurisdictions:read")) {
    return <WorkspaceAccessState title={t("app.jurisdiction.accessRequired")} description={t("app.jurisdiction.description")} />;
  }

  const jurisdiction = await prisma.jurisdiction.findFirst({
    where: { id, workspaceId: context.principal.workspaceId },
    include: {
      observations: { orderBy: { criterionKey: "asc" } },
      evidence: { orderBy: { updatedAt: "desc" } },
      workingDecisions: {
        where: { workspaceId: context.principal.workspaceId },
        include: {
          comparisonSnapshot: { select: { methodologyVersion: true } },
          formationPlans: { select: { id: true, jurisdictionName: true, status: true, updatedAt: true } },
        },
        orderBy: { decidedAt: "desc" },
      },
    },
  });
  if (!jurisdiction) notFound();

  const evidenceById = new Map(jurisdiction.evidence.map((item) => [item.id, item]));
  const region = profileText(jurisdiction.profile, "region");
  const summary = profileText(jurisdiction.profile, "profileSummary")
    ?? profileText(jurisdiction.profile, "summary")
    ?? jurisdiction.description;
  const plans = jurisdiction.workingDecisions.flatMap((decision) => decision.formationPlans);

  return (
    <div className="page-stack">
      <nav aria-label={t("navigation.breadcrumb")} className="text-sm text-slate-400">
        <Link className="hover:text-white" href="/jurisdictions">{t("navigation.jurisdictionLens")}</Link>
        <span aria-hidden="true" className="px-2">/</span>
        <span className="text-slate-200">{jurisdiction.name}</span>
      </nav>

      <header className="page-header">
        <div>
          <p className="eyebrow">{jurisdiction.countryCode ?? jurisdiction.code ?? jurisdiction.country}</p>
          <h1>{jurisdiction.name}</h1>
          <p>{[jurisdiction.country, region].filter(Boolean).join(" · ") || t("app.jurisdiction.profile")}</p>
        </div>
        <span className="status-badge status-info">{context.activeWorkspace.name}</span>
      </header>

      <TrustBoundaryNotice
        gaps={jurisdiction.evidence.length === 0 ? ["NO_EVIDENCE"] : undefined}
      />

      <section className="border-y border-white/10 py-5">
        <h2 className="text-sm font-semibold text-white">{t("app.jurisdiction.profileOverview")}</h2>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
          {summary || t("app.jurisdiction.profileSummaryMissing")}
        </p>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-500">
          {jurisdiction.reviewDate ? <span>{t("app.jurisdiction.reviewDate", { date: formatDate(jurisdiction.reviewDate, locale, { dateStyle: "medium" }) })}</span> : null}
          <span>{t("app.jurisdiction.observedCriteria", { count: jurisdiction.observations.length })}</span>
          <span>{t("app.jurisdiction.evidenceRecords", { count: jurisdiction.evidence.length })}</span>
        </div>
      </section>

      <section className="space-y-3">
        <header className="section-header">
          <div>
            <h2>{t("app.jurisdiction.criteria")}</h2>
            <p>{t("app.jurisdiction.criteriaDescription")}</p>
          </div>
        </header>
        {jurisdiction.observations.length ? (
          <div className="divide-y divide-white/10 border-y border-white/10">
            {jurisdiction.observations.map((observation) => (
              <article key={observation.id} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-start">
                <div>
                  <h3 className="text-sm font-medium text-white">{observation.criterionKey.replaceAll("_", " ")}</h3>
                  {observation.assumptions.length ? (
                    <ul className="mt-2 space-y-1 text-xs leading-5 text-slate-400">
                      {observation.assumptions.map((assumption, index) => <li key={`${observation.id}:${index}`}>{assumption}</li>)}
                    </ul>
                  ) : <p className="mt-1 text-xs text-slate-500">{t("app.jurisdiction.noAssumptions")}</p>}
                  {observation.evidenceIds.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {observation.evidenceIds.map((evidenceId) => {
                        const evidence = evidenceById.get(evidenceId);
                        return evidence ? (
                          <span key={evidenceId} className="inline-flex items-center gap-2 rounded-md border border-white/10 px-2 py-1 text-xs text-slate-300">
                            <EvidenceBadge evidenceClass={evidenceClasses[evidence.evidenceClass] ?? "E0"} />
                            {evidence.source ?? evidence.title}
                          </span>
                        ) : <span key={evidenceId} className="text-xs text-slate-500">{t("app.jurisdiction.unresolvedEvidence")}</span>;
                      })}
                    </div>
                  ) : null}
                </div>
                <span className="text-sm font-medium text-slate-200">{displayValue(observation.value, t("app.jurisdiction.yes"), t("app.jurisdiction.no"), t("app.jurisdiction.unknown"))}</span>
                <span className={observation.reviewRequired ? "status-badge status-warning" : "status-badge status-neutral"}>
                  {observation.reviewRequired ? t("app.jurisdiction.reviewRequired") : t("app.jurisdiction.notFlagged")}
                </span>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-white/10 p-8 text-sm text-slate-400">
            {t("app.jurisdiction.noCriteria")}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <header className="section-header">
          <div>
            <h2>{t("app.jurisdiction.evidenceRegister")}</h2>
            <p>{t("app.jurisdiction.evidenceDescription")}</p>
          </div>
          <span className="text-xs text-slate-500">{t("app.jurisdiction.records", { count: jurisdiction.evidence.length })}</span>
        </header>
        {jurisdiction.evidence.length ? (
          <div className="divide-y divide-white/10 border-y border-white/10">
            {jurisdiction.evidence.map((item) => (
              <article key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-medium text-white">{item.title}</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {item.source ?? item.sourceType ?? t("app.jurisdiction.sourceMissing")}
                    {item.publicationDate ? ` · ${t("app.jurisdiction.published", { date: formatDate(item.publicationDate, locale, { dateStyle: "medium" }) })}` : ""}
                  </p>
                </div>
                <EvidenceBadge evidenceClass={evidenceClasses[item.evidenceClass] ?? "E0"} />
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-white/10 p-8 text-sm text-slate-400">
            {t("app.jurisdiction.noEvidenceSources")}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <header className="section-header">
          <div>
            <h2>{t("app.jurisdiction.decisionTrail")}</h2>
            <p>{t("app.jurisdiction.decisionTrailDescription")}</p>
          </div>
          <Link href="/formation" className="button">{t("app.jurisdiction.openFormation")}</Link>
        </header>
        {context.principal.permissions.includes("formation:read") && jurisdiction.workingDecisions.length ? (
          <div className="divide-y divide-white/10 border-y border-white/10">
            {jurisdiction.workingDecisions.map((decision) => (
              <article key={decision.id} className="py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-white">
                    {t("app.jurisdiction.selected", { date: formatDate(decision.decidedAt, locale, { dateStyle: "medium" }) })}
                  </p>
                  <span className="status-badge status-warning">
                    {decision.professionalReviewCompleted ? t("app.jurisdiction.reviewCompleted") : t("app.jurisdiction.reviewPending")}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {t("app.jurisdiction.methodology", { version: decision.comparisonSnapshot.methodologyVersion })}
                  {decision.rationale ? ` · ${decision.rationale}` : ` · ${t("app.jurisdiction.noRationale")}`}
                </p>
                {decision.formationPlans.length ? (
                  <ul className="mt-3 space-y-2">
                    {decision.formationPlans.map((plan) => (
                      <li key={plan.id} className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
                        <span>{plan.jurisdictionName}</span>
                        <span className="status-badge status-info">{plan.status.replaceAll("_", " ")}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-white/10 p-6 text-sm text-slate-400">
            {t("app.jurisdiction.noWorkingDecisions")}
          </p>
        )}
      </section>

      <aside className="rounded-lg border border-amber-300/10 bg-amber-300/[0.035] p-4 text-xs leading-5 text-slate-400">
        {t("app.jurisdiction.trustBoundary")}
      </aside>
    </div>
  );
}