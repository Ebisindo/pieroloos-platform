"use client";

import { localizeApiError } from "@/lib/i18n/api-errors";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { OperationalAction, ControlActionStatus } from "@/lib/domain/action-control";
import { ACTION_TRANSITIONS } from "@/lib/domain/action-control";
import { StatusBadge } from "@/components/ui/primitives";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { MessageKey } from "@/lib/i18n/messages";
import { formatDate } from "@/lib/i18n/messages";

type Assignee = { userId: string; name: string | null; email: string };

const statusLabel: Record<ControlActionStatus, MessageKey> = {
  OPEN: "app.actions.statusOpen",
  ASSIGNED: "app.actions.statusAssigned",
  IN_PROGRESS: "app.actions.statusInProgress",
  BLOCKED: "app.actions.statusBlocked",
  PENDING_REVIEW: "app.actions.statusPendingReview",
  RESOLVED: "app.actions.statusResolved",
  CANCELLED: "app.actions.statusCancelled",
};
const priorityLabel: Record<string, MessageKey> = {
  CRITICAL: "app.actions.priorityCritical",
  HIGH: "app.actions.priorityHigh",
  MEDIUM: "app.actions.priorityMedium",
  LOW: "app.actions.priorityLow",
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
  const { locale, t } = useLocale();
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
      if (!response.ok) throw new Error(localizeApiError(t, result.error, t("app.actions.updateError")));
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("app.actions.updateError"));
    } finally {
      setBusyId("");
    }
  }

  if (!actions.length) {
    return <div className="empty-inline">{t("app.actions.none")}</div>;
  }

  return (
    <>
      {error ? <p className="action-error" role="alert">{error}</p> : null}
      <ol className="action-list" aria-label={t("app.actions.ariaLabel")}>
        {actions.map((action) => {
          const availableTransitions = (ACTION_TRANSITIONS[action.status] ?? [])
            .filter((status) => status !== "ASSIGNED" && status !== "RESOLVED");
          const selectedAssignee = selectedAssignees[action.id] ?? action.assigneeUserId ?? "";
          const assigneeLabel = assignees.find((assignee) => assignee.userId === action.assigneeUserId);

          return (
            <li className="action-row" key={action.id}>
              <div className="action-copy">
                <h3 className="action-title">{action.title}</h3>
                {action.description ? <p className="action-description">{action.description}</p> : null}
                <p className="action-assignee">
                  {assigneeLabel ? t("app.actions.assignedTo", { assignee: assigneeLabel.name || assigneeLabel.email }) : t("app.actions.unassigned")}
                </p>
              </div>
              <div className="action-details">
                <StatusBadge tone={statusTone[action.status] ?? "neutral"}>{statusLabel[action.status] ? t(statusLabel[action.status]) : action.status}</StatusBadge>
                <StatusBadge tone={action.priority === "CRITICAL" ? "danger" : action.priority === "HIGH" ? "warning" : "neutral"}>
                  {priorityLabel[action.priority] ? t(priorityLabel[action.priority]) : action.priority}
                </StatusBadge>
                {action.escalationLevel > 0 ? <StatusBadge tone="danger">{t("app.actions.escalation", { level: action.escalationLevel })}</StatusBadge> : null}
                {action.dueAt ? (
                  <time className="action-due" dateTime={action.dueAt.toISOString()}>
                    {t("app.actions.due")} {formatDate(action.dueAt, locale, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} {t("app.notifications.utc")}
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
                      <label htmlFor={`assignee-${action.id}`}>{t("app.actions.assignTo")}</label>
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
                        <option value="" disabled>{assignees.length ? t("app.actions.selectMember") : t("app.actions.noMembers")}</option>
                        {assignees.map((assignee) => (
                          <option key={assignee.userId} value={assignee.userId}>
                            {assignee.name || assignee.email}
                          </option>
                        ))}
                      </select>
                      <button className="button" type="submit" disabled={busyId === action.id || !selectedAssignee}>
                        {t("app.actions.assign")}
                      </button>
                    </form>
                  ) : null}
                  {availableTransitions.length ? (
                    <div className="action-control action-transition-control">
                      <span>{t("app.actions.updateStatus")}</span>
                      {availableTransitions.map((status) => (
                        <button
                          className="button"
                          type="button"
                          key={status}
                          disabled={busyId === action.id}
                          onClick={() => void sendAction(action, "transition", { status })}
                        >
                          {t(statusLabel[status])}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {(ACTION_TRANSITIONS[action.status] ?? []).includes("RESOLVED") ? (
                    <form
                      className="action-control"
                      onSubmit={(event) => {
                        event.preventDefault();
                        const resolutionNote = resolutionNotes[action.id]?.trim();
                        if (resolutionNote) void sendAction(action, "resolve", { resolutionNote });
                      }}
                    >
                      <label htmlFor={`resolution-${action.id}`}>{t("app.actions.resolutionNote")}</label>
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
                        {t("app.actions.resolve")}
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
