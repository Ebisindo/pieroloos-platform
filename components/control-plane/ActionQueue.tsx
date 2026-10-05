import type { OperationalAction } from "@/lib/domain/action-control";
import { StatusBadge } from "@/components/ui/primitives";

const statusLabel: Record<OperationalAction["status"], string> = {
  OPEN: "Open", ASSIGNED: "Assigned", IN_PROGRESS: "In progress", BLOCKED: "Blocked",
  PENDING_REVIEW: "Pending review", RESOLVED: "Resolved", CANCELLED: "Cancelled",
};

const statusTone: Record<OperationalAction["status"], "neutral" | "success" | "warning" | "danger" | "info"> = {
  OPEN: "warning",
  ASSIGNED: "info",
  IN_PROGRESS: "info",
  BLOCKED: "danger",
  PENDING_REVIEW: "warning",
  RESOLVED: "success",
  CANCELLED: "neutral",
};

export function ActionQueue({ actions }: { actions: OperationalAction[] }) {
  if (!actions.length) {
    return <div className="empty-inline">No active operational actions require attention.</div>;
  }

  return (
    <ol className="action-list" aria-label="Active operational actions">
      {actions.map((action) => (
        <li className="action-row" key={action.id}>
          <div className="action-copy">
            <h3 className="action-title">{action.title}</h3>
            {action.description ? <p className="action-description">{action.description}</p> : null}
          </div>
          <div className="action-details">
            <StatusBadge tone={statusTone[action.status]}>{statusLabel[action.status]}</StatusBadge>
            <StatusBadge tone={action.priority === "CRITICAL" ? "danger" : action.priority === "HIGH" ? "warning" : "neutral"}>
              {action.priority}
            </StatusBadge>
            {action.escalationLevel > 0 ? <StatusBadge tone="danger">Escalation {action.escalationLevel}</StatusBadge> : null}
            {action.dueAt ? (
              <time className="action-due" dateTime={action.dueAt.toISOString()}>
                Due {action.dueAt.toLocaleString()}
              </time>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
