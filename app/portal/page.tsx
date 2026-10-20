import Link from "next/link";
import { redirect } from "next/navigation";
import { WorkspaceAccessState } from "@/components/auth/WorkspaceAccessState";
import { ClientEvidenceUpload } from "@/components/portal/ClientEvidenceUpload";
import { ClientPortalCollaboration } from "@/components/portal/ClientPortalCollaboration";
import { getClientPortalContext } from "@/lib/auth/client-portal-context";
import {
  getClientPortalOverview,
  listClientPortalInteractions,
} from "@/lib/services/client-portal-service";
import { getRequestLocale, getRequestTranslator } from "@/lib/i18n/request";
import { formatDate, type MessageKey } from "@/lib/i18n/messages";
import type { Locale } from "@/lib/i18n/config";

const statusKeys: Record<string, MessageKey> = {
  DRAFT: "app.status.draft",
  READY: "app.status.ready",
  INTAKE: "app.status.intake",
  ASSESSMENT: "app.status.assessment",
  PLANNING: "app.status.planning",
  EXECUTION: "app.status.execution",
  VERIFICATION: "app.status.verification",
  RECORDING: "app.status.recording",
  APPROVAL: "app.status.approval",
  ACTIVE: "app.status.active",
  ON_HOLD: "app.status.onHold",
  IN_PROGRESS: "app.status.inProgress",
  BLOCKED: "app.status.blocked",
  PENDING: "app.status.pending",
  IN_REVIEW: "app.status.inReview",
  COMPLETED: "app.status.completed",
  COMPLETE: "app.status.complete",
  CANCELLED: "app.status.cancelled",
  ARCHIVED: "app.status.archived",
  WAIVED: "app.status.waived",
  SKIPPED: "app.status.skipped",
  NOT_APPLICABLE: "app.status.notApplicable",
};

function displayDate(value: Date | null, locale: Locale, noDateLabel: string) {
  return value ? formatDate(value, locale, { dateStyle: "medium" }) : noDateLabel;
}

function displayStatus(status: string, t: (key: MessageKey) => string) {
  return statusKeys[status] ? t(statusKeys[status]) : status.replaceAll("_", " ");
}

export default async function ClientPortalPage() {
  const [t, locale] = await Promise.all([getRequestTranslator(), getRequestLocale()]);
  const context = await getClientPortalContext();
  if (!context.userId) redirect("/signin?callbackUrl=/portal");

  if (context.grants.length === 0) {
    return (
      <WorkspaceAccessState
        title={t("app.portal.accessDisabled")}
        description={t("app.portal.grantAccessDescription")}
      />
    );
  }

  const overviews = await Promise.all(context.grants.map((grant) =>
    grant.canViewStatus
      ? getClientPortalOverview({
          userId: context.userId!,
          organizationId: grant.organizationId,
          workspaceId: grant.workspaceId,
          clientId: grant.clientId,
          clientPortalGrantId: grant.id,
        })
      : Promise.resolve(null),
  ));
  const interactionLists = await Promise.all(context.grants.map((grant) =>
    grant.canViewStatus
      ? listClientPortalInteractions({
          userId: context.userId!,
          organizationId: grant.organizationId,
          workspaceId: grant.workspaceId,
          clientId: grant.clientId,
          clientPortalGrantId: grant.id,
        })
      : Promise.resolve([]),
  ));

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-6 py-10">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-300/70">{t("app.portal.eyebrow")}</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">{t("app.portal.title")}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          {t("app.portal.description")}
        </p>
      </header>

      <div className="space-y-8">
        {context.grants.map((grant, index) => {
          const overview = overviews[index];
          const clientName = overview?.client.displayName
            ?? grant.client.organizationName
            ?? grant.client.name
            ?? [grant.client.firstName, grant.client.lastName].filter(Boolean).join(" ")
            ?? t("app.portal.clientWorkspace");

          return (
            <section key={grant.id} className="space-y-5 rounded-2xl border border-white/10 bg-slate-900/50 p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-white">{clientName}</h2>
                  <p className="mt-1 text-sm text-slate-400">{t("app.portal.accessScope")}</p>
                </div>
                <span className="rounded-full border border-cyan-300/20 px-3 py-1 text-xs uppercase tracking-wider text-cyan-100">
                  {t("app.portal.clientPortal")}
                </span>
              </div>

              {!overview ? (
                <p className="text-sm text-slate-400">{t("app.portal.statusNotEnabled")}</p>
              ) : (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    {overview.engagements.map((engagement) => (
                      <article key={engagement.id} className="rounded-xl border border-white/10 p-4">
                        <p className="text-xs uppercase tracking-wider text-slate-500">{engagement.service}</p>
                        <h3 className="mt-2 font-medium text-white">{displayStatus(engagement.status, t)}</h3>
                        {engagement.dueAt ? <p className="mt-1 text-xs text-slate-500">{t("app.portal.targetDate")}: {displayDate(engagement.dueAt, locale, t("app.portal.noDate"))}</p> : null}
                        {grant.canViewTasks && engagement.tasks.length ? (
                          <ul className="mt-4 space-y-2 border-t border-white/10 pt-3">
                            {engagement.tasks.map((task) => (
                              <li key={task.id} className="flex items-center justify-between gap-3 text-sm">
                                <span className="text-slate-200">{task.title}</span>
                                <span className="text-xs text-slate-400">{displayStatus(task.status, t)}</span>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </article>
                    ))}
                    {overview.formationPlans.map((plan) => (
                      <article key={plan.id} className="rounded-xl border border-white/10 p-4">
                        <p className="text-xs uppercase tracking-wider text-slate-500">{t("navigation.formation")} · {plan.jurisdictionName}</p>
                        <h3 className="mt-2 font-medium text-white">{displayStatus(plan.status, t)}</h3>
                        {plan.stages.flatMap((stage) => stage.tasks).length ? (
                          <ul className="mt-4 space-y-2 border-t border-white/10 pt-3">
                            {plan.stages.flatMap((stage) => stage.tasks).map((task) => (
                              <li key={task.id} className="flex items-center justify-between gap-3 text-sm">
                                <span className="text-slate-200">{task.title}</span>
                                <span className="text-xs text-slate-400">{displayStatus(task.status, t)}</span>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </article>
                    ))}
                  </div>

                  {grant.canViewTasks && overview.obligations.length ? (
                    <section className="space-y-2">
                      <h3 className="font-medium text-white">{t("app.portal.sharedRequests")}</h3>
                      <ul className="divide-y divide-white/10 rounded-xl border border-white/10">
                        {overview.obligations.map((obligation) => (
                          <li key={obligation.id} className="flex flex-wrap justify-between gap-2 px-4 py-3 text-sm">
                            <span className="text-slate-200">{obligation.title}</span>
                            <span className="text-slate-400">
                              {displayStatus(obligation.status, t)} · {displayDate(obligation.dueAt, locale, t("app.portal.noDate"))}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}

                  {grant.canViewTasks && overview.nextActions.length ? (
                    <section className="space-y-2">
                      <h3 className="font-medium text-white">{t("app.portal.requiredNextActions")}</h3>
                      <ul className="space-y-2">
                        {overview.nextActions.map((action) => (
                          <li key={action.id} className="rounded-lg border border-amber-300/15 bg-amber-300/[0.04] px-4 py-3 text-sm text-amber-100">
                            {action.title}
                            {action.relatedTask ? <span className="ml-2 text-xs text-slate-400">· {action.relatedTask}</span> : null}
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}

                  {grant.canUploadEvidence ? <ClientEvidenceUpload clientId={grant.clientId} /> : null}

                  {overview.documents.length ? (
                    <section className="space-y-2">
                      <h3 className="font-medium text-white">{t("app.portal.evidenceUploads")}</h3>
                      <ul className="divide-y divide-white/10 rounded-xl border border-white/10">
                        {overview.documents.map((document) => (
                          <li key={document.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                            <span className="text-slate-200">{document.name}</span>
                            <span className="flex items-center gap-3 text-xs text-slate-400">
                              {document.scanStatus.replaceAll("_", " ")} · {document.reviewStatus.replaceAll("_", " ")}
                              {document.status === "AVAILABLE" && document.scanStatus === "CLEAN" ? (
                                <Link
                                  className="text-cyan-200 underline underline-offset-2"
                                  href={`/api/portal/clients/${encodeURIComponent(grant.clientId)}/documents/${encodeURIComponent(document.id)}/download`}
                                >
                                  {t("app.portal.download")}
                                </Link>
                              ) : null}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}

                  {grant.canViewStatus ? (
                    <ClientPortalCollaboration
                      clientId={grant.clientId}
                      interactions={interactionLists[index]}
                      resources={[
                        ...overview.engagements.flatMap((engagement) => engagement.tasks.map((task) => ({
                          id: task.id,
                          type: "TASK" as const,
                          title: task.title,
                        }))),
                        ...overview.formationPlans.flatMap((plan) => plan.stages.flatMap((stage) =>
                          stage.tasks.map((task) => ({
                            id: task.id,
                            type: "FORMATION_TASK" as const,
                            title: task.title,
                          })),
                        )),
                        ...overview.obligations.map((obligation) => ({
                          id: obligation.id,
                          type: "OBLIGATION" as const,
                          title: obligation.title,
                        })),
                      ]}
                    />
                  ) : null}
                </>
              )}
            </section>
          );
        })}
      </div>
      <p className="text-xs leading-5 text-slate-500">
        {t("app.portal.disclaimer")}
      </p>
    </main>
  );
}
