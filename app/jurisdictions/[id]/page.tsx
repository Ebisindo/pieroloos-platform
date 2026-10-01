import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { WorkspaceAccessState } from "@/components/auth/WorkspaceAccessState";
import { EvidenceBadge } from "@/components/jurisdiction/EvidenceBadge";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { prisma } from "@/lib/db/prisma";
import type { EvidenceClass } from "@/lib/domain/jurisdiction";

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

function displayValue(value: number | string | boolean | null) {
  if (value === null) return "Unknown";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

export default async function JurisdictionDetailPage({ params }: PageProps) {
  const { id } = await params;
  const context = await getWorkspaceContext();
  if (!context.userId) redirect(`/signin?callbackUrl=${encodeURIComponent(`/jurisdictions/${id}`)}`);
  if (!context.activeWorkspace || !context.principal) {
    return <WorkspaceAccessState title="Workspace selection required" description="Select an active workspace to view jurisdiction details." />;
  }
  if (!context.principal.permissions.includes("jurisdictions:read")) {
    return <WorkspaceAccessState title="Jurisdiction access required" description="Your workspace role cannot view jurisdiction details." />;
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
      <nav aria-label="Breadcrumb" className="text-sm text-slate-400">
        <Link className="hover:text-white" href="/jurisdictions">Jurisdiction Lens</Link>
        <span aria-hidden="true" className="px-2">/</span>
        <span className="text-slate-200">{jurisdiction.name}</span>
      </nav>

      <header className="page-header">
        <div>
          <p className="eyebrow">{jurisdiction.countryCode ?? jurisdiction.code ?? jurisdiction.country}</p>
          <h1>{jurisdiction.name}</h1>
          <p>{[jurisdiction.country, region].filter(Boolean).join(" · ") || "Jurisdiction profile"}</p>
        </div>
        <span className="status-badge status-info">{context.activeWorkspace.name}</span>
      </header>

      <section className="border-y border-white/10 py-5">
        <h2 className="text-sm font-semibold text-white">Profile overview</h2>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
          {summary || "No jurisdiction profile summary has been recorded."}
        </p>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-500">
          {jurisdiction.reviewDate ? <span>Last review: {new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(jurisdiction.reviewDate)}</span> : null}
          <span>{jurisdiction.observations.length} observed criteria</span>
          <span>{jurisdiction.evidence.length} evidence records</span>
        </div>
      </section>

      <section className="space-y-3">
        <header className="section-header">
          <div>
            <h2>Observed criteria</h2>
            <p>Recorded observations and assumptions for this jurisdiction.</p>
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
                  ) : <p className="mt-1 text-xs text-slate-500">No assumptions recorded.</p>}
                  {observation.evidenceIds.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {observation.evidenceIds.map((evidenceId) => {
                        const evidence = evidenceById.get(evidenceId);
                        return evidence ? (
                          <span key={evidenceId} className="inline-flex items-center gap-2 rounded-md border border-white/10 px-2 py-1 text-xs text-slate-300">
                            <EvidenceBadge evidenceClass={evidenceClasses[evidence.evidenceClass] ?? "E0"} />
                            {evidence.source ?? evidence.title}
                          </span>
                        ) : <span key={evidenceId} className="text-xs text-slate-500">Unresolved evidence reference</span>;
                      })}
                    </div>
                  ) : null}
                </div>
                <span className="text-sm font-medium text-slate-200">{displayValue(observation.value)}</span>
                <span className={observation.reviewRequired ? "status-badge status-warning" : "status-badge status-neutral"}>
                  {observation.reviewRequired ? "Review required" : "Not flagged"}
                </span>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-white/10 p-8 text-sm text-slate-400">
            No criterion observations have been recorded for this jurisdiction.
          </div>
        )}
      </section>

      <section className="space-y-3">
        <header className="section-header">
          <div>
            <h2>Evidence register</h2>
            <p>Sources attached directly to this jurisdiction profile.</p>
          </div>
          <span className="text-xs text-slate-500">{jurisdiction.evidence.length} records</span>
        </header>
        {jurisdiction.evidence.length ? (
          <div className="divide-y divide-white/10 border-y border-white/10">
            {jurisdiction.evidence.map((item) => (
              <article key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-medium text-white">{item.title}</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {item.source ?? item.sourceType ?? "Source not specified"}
                    {item.publicationDate ? ` · Published ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(item.publicationDate)}` : ""}
                  </p>
                </div>
                <EvidenceBadge evidenceClass={evidenceClasses[item.evidenceClass] ?? "E0"} />
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-white/10 p-8 text-sm text-slate-400">
            No evidence sources have been attached yet. Missing information remains unknown, not a zero score.
          </div>
        )}
      </section>

      <section className="space-y-3">
        <header className="section-header">
          <div>
            <h2>Decision and plan trail</h2>
            <p>Human-recorded working jurisdiction decisions and related formation plans.</p>
          </div>
          <Link href="/formation" className="button">Open Formation</Link>
        </header>
        {context.principal.permissions.includes("formation:read") && jurisdiction.workingDecisions.length ? (
          <div className="divide-y divide-white/10 border-y border-white/10">
            {jurisdiction.workingDecisions.map((decision) => (
              <article key={decision.id} className="py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-white">
                    Selected {new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(decision.decidedAt)}
                  </p>
                  <span className="status-badge status-warning">
                    {decision.professionalReviewCompleted ? "Review completed" : "Professional review pending"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Methodology {decision.comparisonSnapshot.methodologyVersion}
                  {decision.rationale ? ` · ${decision.rationale}` : " · No rationale recorded"}
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
            No working jurisdiction decisions have been recorded for this workspace.
          </p>
        )}
      </section>

      <aside className="rounded-lg border border-amber-300/10 bg-amber-300/[0.035] p-4 text-xs leading-5 text-slate-400">
        Evidence and observations support internal comparison only. They are not legal, tax, regulatory, banking, or other professional conclusions.
      </aside>
    </div>
  );
}