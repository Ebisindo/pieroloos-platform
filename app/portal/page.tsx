import Link from "next/link";
import { redirect } from "next/navigation";
import { WorkspaceAccessState } from "@/components/auth/WorkspaceAccessState";
import { ClientEvidenceUpload } from "@/components/portal/ClientEvidenceUpload";
import { getClientPortalContext } from "@/lib/auth/client-portal-context";
import { getClientPortalOverview } from "@/lib/services/client-portal-service";

function displayDate(value: Date | null) {
  return value ? new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(value) : "No date set";
}

export default async function ClientPortalPage() {
  const context = await getClientPortalContext();
  if (!context.userId) redirect("/signin?callbackUrl=/portal");

  if (context.grants.length === 0) {
    return (
      <WorkspaceAccessState
        title="Client portal access is not enabled"
        description="Ask your professional service team to grant access to your client workspace."
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

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-6 py-10">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-300/70">PieroloOS Client Portal</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Your workspace</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          Follow progress, review items your professional team has shared, and securely provide requested evidence.
        </p>
      </header>

      <div className="space-y-8">
        {context.grants.map((grant, index) => {
          const overview = overviews[index];
          const clientName = overview?.client.displayName
            ?? grant.client.organizationName
            ?? grant.client.name
            ?? [grant.client.firstName, grant.client.lastName].filter(Boolean).join(" ")
            ?? "Client workspace";

          return (
            <section key={grant.id} className="space-y-5 rounded-2xl border border-white/10 bg-slate-900/50 p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-white">{clientName}</h2>
                  <p className="mt-1 text-sm text-slate-400">Portal access is scoped to this client record.</p>
                </div>
                <span className="rounded-full border border-cyan-300/20 px-3 py-1 text-xs uppercase tracking-wider text-cyan-100">
                  Client portal
                </span>
              </div>

              {!overview ? (
                <p className="text-sm text-slate-400">Status sharing has not been enabled for this access grant.</p>
              ) : (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    {overview.engagements.map((engagement) => (
                      <article key={engagement.id} className="rounded-xl border border-white/10 p-4">
                        <p className="text-xs uppercase tracking-wider text-slate-500">{engagement.service}</p>
                        <h3 className="mt-2 font-medium text-white">{engagement.status.replaceAll("_", " ")}</h3>
                        {engagement.dueAt ? <p className="mt-1 text-xs text-slate-500">Target date: {displayDate(engagement.dueAt)}</p> : null}
                        {grant.canViewTasks && engagement.tasks.length ? (
                          <ul className="mt-4 space-y-2 border-t border-white/10 pt-3">
                            {engagement.tasks.map((task) => (
                              <li key={task.id} className="flex items-center justify-between gap-3 text-sm">
                                <span className="text-slate-200">{task.title}</span>
                                <span className="text-xs text-slate-400">{task.status.replaceAll("_", " ")}</span>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </article>
                    ))}
                    {overview.formationPlans.map((plan) => (
                      <article key={plan.id} className="rounded-xl border border-white/10 p-4">
                        <p className="text-xs uppercase tracking-wider text-slate-500">Formation · {plan.jurisdictionName}</p>
                        <h3 className="mt-2 font-medium text-white">{plan.status.replaceAll("_", " ")}</h3>
                        {plan.stages.flatMap((stage) => stage.tasks).length ? (
                          <ul className="mt-4 space-y-2 border-t border-white/10 pt-3">
                            {plan.stages.flatMap((stage) => stage.tasks).map((task) => (
                              <li key={task.id} className="flex items-center justify-between gap-3 text-sm">
                                <span className="text-slate-200">{task.title}</span>
                                <span className="text-xs text-slate-400">{task.status.replaceAll("_", " ")}</span>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </article>
                    ))}
                  </div>

                  {grant.canViewTasks && overview.obligations.length ? (
                    <section className="space-y-2">
                      <h3 className="font-medium text-white">Shared requests</h3>
                      <ul className="divide-y divide-white/10 rounded-xl border border-white/10">
                        {overview.obligations.map((obligation) => (
                          <li key={obligation.id} className="flex flex-wrap justify-between gap-2 px-4 py-3 text-sm">
                            <span className="text-slate-200">{obligation.title}</span>
                            <span className="text-slate-400">
                              {obligation.status.replaceAll("_", " ")} · {displayDate(obligation.dueAt)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}

                  {grant.canViewTasks && overview.nextActions.length ? (
                    <section className="space-y-2">
                      <h3 className="font-medium text-white">Required next actions</h3>
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
                      <h3 className="font-medium text-white">Your evidence uploads</h3>
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
                                  Download
                                </Link>
                              ) : null}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}
                </>
              )}
            </section>
          );
        })}
      </div>
      <p className="text-xs leading-5 text-slate-500">
        This portal shares workflow status and evidence only. It does not provide legal or regulatory determinations.
      </p>
    </main>
  );
}
