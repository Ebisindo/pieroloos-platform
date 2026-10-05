"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { OperationalAction, ControlActionStatus } from "@/lib/domain/action-control";
import { ACTION_TRANSITIONS } from "@/lib/domain/action-control";
import { StatusBadge } from "@/components/ui/primitives";

type Assignee = { userId: string; name: string | null; email: string };

const statusLabel: Record<ControlActionStatus, string> = {
  OPEN: "Open", ASSIGNED: "Assigned", IN_PROGRESS: "In progress", BLOCKED: "Blocked",
  PENDING_REVIEW: "Pending review", RESOLVED: "Resolved", CANCELLED: "Cancelled",
};

const statusTone: Record<ControlActionStatus, "neutral" | "success" | "warning" | "danger" | "info"> = {
  OPEN: "warning",
  ASSIGNED: "info",
  IN_PROGRESS: "info",
  BLOCKED: "danger",
  PENDING_REVIEW: "warning",
  RESOLVED: "success",
  CANCELLED: "neutral",
};

export function ActionQueue({
  actions,
  canManage = false,
  assignees = [],
}: {
  actions: OperationalAction[];
  canManage?: boolean;
  assignees?: Assignee[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [selectedAssignees, setSelectedAssignees] = useState<Record<string, string>>({});
  const [resolutionNotes, setResolutionNotes] = useState<Record<string, string>>({});

  async function sendAction(action: OperationalAction, path: string, body: Record<string, string>) {
    setBusyId(action.id);
    setError("");
    try {
      const response = await fetch(`/api/control-plane/actions/${action.id}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, expectedUpdatedAt: action.updatedAt.toISOString() }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to update operational action.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update operational action.");
    } finally {
      setBusyId("");
    }
  }

  if (!actions.length) {
    return <div className="empty-inline">No active operational actions require attention.</div>;
  }

  return (
    <>
      {error ? <p className="action-error" role="alert">{error}</p> : null}
      <ol className="action-list" aria-label="Active operational actions">
        {actions.map((action) => {
          const availableTransitions = ACTION_TRANSITIONS[action.status]
            .filter((status) => status !== "ASSIGNED" && status !== "RESOLVED");
          const selectedAssignee = selectedAssignees[action.id] ?? action.assigneeUserId ?? "";
          const assigneeLabel = assignees.find((assignee) => assignee.userId === action.assigneeUserId);

          return (
            <li className="action-row" key={action.id}>
              <div className="action-copy">
                <h3 className="action-title">{action.title}</h3>
                {action.description ? <p className="action-description">{action.description}</p> : null}
                <p className="action-assignee">
                  {assigneeLabel ? `Assigned to ${assigneeLabel.name || assigneeLabel.email}` : "Unassigned"}
                </p>
              </div>
              <div className="action-details">
                <StatusBadge tone={statusTone[action.status]}>{statusLabel[action.status]}</StatusBadge>
                <StatusBadge tone={action.priority === "CRITICAL" ? "danger" : action.priority === "HIGH" ? "warning" : "neutral"}>
                  {action.priority}
                </StatusBadge>
                {action.escalationLevel > 0 ? <StatusBadge tone="danger">Escalation {action.escalationLevel}</StatusBadge> : null}
                {action.dueAt ? (
                  <time className="action-due" dateTime={action.dueAt.toISOString()}>
                    Due {action.dueAt.toISOString().replace("T", " ").slice(0, 16)} UTC
                  </time>
                ) : null}
              </div>
              {canManage ? (
                <div className="action-management">
                  {["OPEN", "ASSIGNED"].includes(action.status) ? (
                    <form
                      className="action-control"
                      onSubmit={(event) => {
                        event.preventDefault();
                        if (selectedAssignee) {
                          void sendAction(action, "assign", { assigneeUserId: selectedAssignee });
                        }
                      }}
                    >
                      <label htmlFor={`assignee-${action.id}`}>Assign to</label>
                      <select
                        id={`assignee-${action.id}`}
                        className="form-input"
                        value={selectedAssignee}
                        disabled={busyId === action.id || assignees.length === 0}
                        onChange={(event) => setSelectedAssignees((current) => ({
                          ...current,
                          [action.id]: event.target.value,
                        }))}
                      >
                        <option value="" disabled>{assignees.length ? "Select a team member" : "No team members available"}</option>
                        {assignees.map((assignee) => (
                          <option key={assignee.userId} value={assignee.userId}>
                            {assignee.name || assignee.email}
                          </option>
                        ))}
                      </select>
                      <button className="button" type="submit" disabled={busyId === action.id || !selectedAssignee}>
                        Assign
                      </button>
                    </form>
                  ) : null}
                  {availableTransitions.length ? (
                    <div className="action-control action-transition-control">
                      <span>Update status</span>
                      {availableTransitions.map((status) => (
                        <button
                          className="button"
                          type="button"
                          key={status}
                          disabled={busyId === action.id}
                          onClick={() => void sendAction(action, "transition", { status })}
                        >
                          {statusLabel[status]}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {ACTION_TRANSITIONS[action.status].includes("RESOLVED") ? (
                    <form
                      className="action-control"
                      onSubmit={(event) => {
                        event.preventDefault();
                        const resolutionNote = resolutionNotes[action.id]?.trim();
                        if (resolutionNote) void sendAction(action, "resolve", { resolutionNote });
                      }}
                    >
                      <label htmlFor={`resolution-${action.id}`}>Resolution note</label>
                      <textarea
                        id={`resolution-${action.id}`}
                        className="form-input"
                        rows={2}
                        required
                        maxLength={2000}
                        value={resolutionNotes[action.id] ?? ""}
                        disabled={busyId === action.id}
                        onChange={(event) => setResolutionNotes((current) => ({
                          ...current,
                          [action.id]: event.target.value,
                        }))}
                      />
                      <button className="button" type="submit" disabled={busyId === action.id || !resolutionNotes[action.id]?.trim()}>
                        Resolve
                      </button>
                    </form>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </>
  );
}
