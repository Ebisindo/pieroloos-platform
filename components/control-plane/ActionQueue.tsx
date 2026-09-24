import type { OperationalAction } from "@/lib/domain/action-control";

const statusLabel: Record<OperationalAction["status"], string> = {
  OPEN: "Open", ASSIGNED: "Assigned", IN_PROGRESS: "In progress", BLOCKED: "Blocked",
  PENDING_REVIEW: "Pending review", RESOLVED: "Resolved", CANCELLED: "Cancelled",
};

export function ActionQueue({ actions }: { actions: OperationalAction[] }) {
  if (!actions.length) {
    return <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 text-sm text-white/55">
      No operational actions require attention.
    </div>;
  }

  return <div className="space-y-2">
    {actions.map(action => (
      <article key={action.id} className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-white">{action.title}</p>
            <p className="mt-1 text-xs text-white/45">{statusLabel[action.status]} · {action.priority}</p>
          </div>
          {action.dueAt && (
            <time className="text-xs text-white/40" dateTime={action.dueAt.toISOString()}>
              Due {action.dueAt.toLocaleString()}
            </time>
          )}
        </div>
      </article>
    ))}
  </div>;
}
