import type { ComplianceControlSnapshot } from "@/lib/domain/compliance-control";
import { getRequestTranslator } from "@/lib/i18n/request";
import type { MessageKey } from "@/lib/i18n/messages";

const metricLabels: Array<[keyof ComplianceControlSnapshot["totals"], MessageKey]> = [
  ["obligations", "app.compliance.title"],
  ["dueSoon", "app.complianceControl.dueSoon"],
  ["overdue", "app.status.overdue"],
  ["blocked", "app.status.blocked"],
  ["awaitingEvidence", "app.complianceControl.evidencePending"],
  ["awaitingReview", "app.complianceControl.reviewPending"],
] as const;

const statusKeys: Record<string, MessageKey> = {
  NOT_STARTED: "app.status.notStarted",
  IN_PROGRESS: "app.status.inProgress",
  AWAITING_EVIDENCE: "app.status.awaitingEvidence",
  IN_REVIEW: "app.status.inReview",
  COMPLETE: "app.status.complete",
  COMPLETED: "app.status.completed",
  COMPLIANT: "app.status.compliant",
  OVERDUE: "app.status.overdue",
  BLOCKED: "app.status.blocked",
};

export async function ComplianceControlCenter({ snapshot }: { snapshot: ComplianceControlSnapshot }) {
  const t = await getRequestTranslator();
  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-white/40">{t("app.complianceControl.eyebrow")}</p>
          <h1 className="mt-2 text-2xl font-semibold text-white">{t("app.complianceControl.title")}</h1>
        </div>
        <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70">
          {statusKeys[snapshot.portfolioStatus] ? t(statusKeys[snapshot.portfolioStatus]) : snapshot.portfolioStatus.replaceAll("_", " ")}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {metricLabels.map(([key, labelKey]) => (
          <div key={key} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <p className="text-xs text-white/45">{t(labelKey)}</p>
            <p className="mt-2 text-2xl font-semibold text-white">{snapshot.totals[key]}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
        <div className="flex justify-between text-sm">
          <span className="text-white/60">{t("app.complianceControl.portfolioCompletion")}</span>
          <span className="text-white">{snapshot.progressPercent}%</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-[#d8b35a]"
            style={{ width: `${snapshot.progressPercent}%` }}
          />
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wider text-white/50">{t("app.complianceControl.priorityAlerts")}</h2>
        {snapshot.alerts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-white/40">
            {t("app.complianceControl.noAlerts")}
          </div>
        ) : snapshot.alerts.map(alert => (
          <div key={alert.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <div className="flex flex-wrap justify-between gap-2">
              <span className="font-medium text-white">{alert.title}</span>
              <span className="text-xs text-white/50">{alert.urgency}</span>
            </div>
            <p className="mt-1 text-xs text-white/45">
              {statusKeys[alert.status] ? t(statusKeys[alert.status]) : alert.status.replaceAll("_", " ")} ·{" "}
              {alert.daysUntilDue === null
                ? t("app.complianceControl.noFixedDeadline")
                : t(alert.daysUntilDue < 0 ? "app.complianceControl.daysOverdue" : "app.complianceControl.daysRemaining", {
                    count: Math.abs(alert.daysUntilDue),
                  })}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
