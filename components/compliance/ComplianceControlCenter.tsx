import type { ComplianceControlSnapshot } from "@/lib/domain/compliance-control";

const metricLabels = [
  ["obligations", "Obligations"],
  ["dueSoon", "Due ≤ 30 days"],
  ["overdue", "Overdue"],
  ["blocked", "Blocked"],
  ["awaitingEvidence", "Evidence pending"],
  ["awaitingReview", "Review pending"],
] as const;

export function ComplianceControlCenter({ snapshot }: { snapshot: ComplianceControlSnapshot }) {
  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-white/40">Compliance intelligence</p>
          <h1 className="mt-2 text-2xl font-semibold text-white">Operational Control Center</h1>
        </div>
        <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70">
          {snapshot.portfolioStatus.replaceAll("_", " ")}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {metricLabels.map(([key, label]) => (
          <div key={key} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <p className="text-xs text-white/45">{label}</p>
            <p className="mt-2 text-2xl font-semibold text-white">{snapshot.totals[key]}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
        <div className="flex justify-between text-sm">
          <span className="text-white/60">Portfolio completion</span>
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
        <h2 className="text-sm font-medium uppercase tracking-wider text-white/50">Priority alerts</h2>
        {snapshot.alerts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-white/40">
            No active compliance alerts.
          </div>
        ) : snapshot.alerts.map(alert => (
          <div key={alert.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <div className="flex flex-wrap justify-between gap-2">
              <span className="font-medium text-white">{alert.title}</span>
              <span className="text-xs text-white/50">{alert.urgency}</span>
            </div>
            <p className="mt-1 text-xs text-white/45">
              {alert.status.replaceAll("_", " ")} ·{" "}
              {alert.daysUntilDue === null
                ? "No fixed deadline"
                : `${Math.abs(alert.daysUntilDue)} day${Math.abs(alert.daysUntilDue) === 1 ? "" : "s"} ${alert.daysUntilDue < 0 ? "overdue" : "remaining"}`}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
