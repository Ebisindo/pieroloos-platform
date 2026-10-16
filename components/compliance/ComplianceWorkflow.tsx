"use client";

import { localizeApiError } from "@/lib/i18n/api-errors";
import { Check, FileCheck2, Plus, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { COMPLIANCE_STATUSES, OBLIGATION_TYPES } from "@/lib/domain/compliance";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { MessageKey } from "@/lib/i18n/messages";
import { formatDate } from "@/lib/i18n/messages";

type ObligationStatus = Exclude<(typeof COMPLIANCE_STATUSES)[number], "OVERDUE">;

type Obligation = {
  id: string;
  clientId: string;
  clientName: string;
  title: string;
  type: string;
  status: string;
  ownerUserId: string | null;
  dueAt: string | null;
  requiresEvidence: boolean;
  evidence: Array<{
    id: string;
    documentId: string;
    evidenceClass: string;
    sourceReference: string | null;
    validThrough: string | null;
    reviewStatus: string;
    reviewNote: string | null;
  }>;
};

type ClientOption = { id: string; name: string };
type DocumentOption = { id: string; name: string; clientId: string };
type TeamMemberOption = { userId: string; name: string };
const terminalStatuses = new Set(["COMPLETE", "COMPLETED", "COMPLIANT", "WAIVED", "NOT_APPLICABLE"]);
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
  WAIVED: "app.status.waived",
  NOT_APPLICABLE: "app.status.notApplicable",
};
const evidenceReviewStatusKeys: Record<string, MessageKey> = {
  VERIFIED: "app.compliance.verified",
  CHANGES_REQUESTED: "app.compliance.changesRequested",
  REVOKED: "app.compliance.revoked",
};
const obligationTypeKeys: Record<string, MessageKey> = {
  FORMATION: "app.compliance.typeFormation",
  GOVERNANCE: "app.compliance.typeGovernance",
  TAX: "app.compliance.typeTax",
  IDENTIFICATION: "app.compliance.typeIdentification",
  BANKING: "app.compliance.typeBanking",
  PAYMENT_INFRASTRUCTURE: "app.compliance.typePaymentInfrastructure",
  ANNUAL_FILING: "app.compliance.typeAnnualFiling",
  LICENSE: "app.compliance.typeLicense",
  REPORTING: "app.compliance.typeReporting",
  RENEWAL: "app.compliance.typeRenewal",
  RECORDKEEPING: "app.compliance.typeRecordkeeping",
  OTHER: "app.compliance.typeOther",
};

export function ComplianceWorkflow({
  obligations,
  clients,
  documents,
  teamMembers,
  canManage,
  canReview,
}: {
  obligations: Obligation[];
  clients: ClientOption[];
  documents: DocumentOption[];
  teamMembers: TeamMemberOption[];
  canManage: boolean;
  canReview: boolean;
}) {
  const { locale, t } = useLocale();
  const router = useRouter();
  const [busyId, setBusyId] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedEvidence, setSelectedEvidence] = useState<Record<string, string>>({});
  const [evidenceSource, setEvidenceSource] = useState<Record<string, string>>({});
  const [evidenceValidThrough, setEvidenceValidThrough] = useState<Record<string, string>>({});
  const [evidenceReviewNotes, setEvidenceReviewNotes] = useState<Record<string, string>>({});
  const [currentTime, setCurrentTime] = useState<number | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setCurrentTime(Date.now()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  function isOverdue(obligation: Obligation) {
    return Boolean(
      currentTime !== null &&
        obligation.dueAt &&
        new Date(obligation.dueAt).getTime() < currentTime &&
        !terminalStatuses.has(obligation.status),
    );
  }

  async function createObligation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setSaving(true);
    setMessage("");
    try {
      const dueDate = String(formData.get("dueAt") ?? "");
      const response = await fetch("/api/compliance/obligations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: formData.get("clientId"),
          title: formData.get("title"),
          type: formData.get("type"),
          description: formData.get("description") || null,
          dueAt: dueDate ? new Date(`${dueDate}T12:00:00`).toISOString() : null,
          requiresEvidence: formData.get("requiresEvidence") === "on",
          professionalReviewRequired: formData.get("professionalReviewRequired") === "on",
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(localizeApiError(t, result.error, t("app.compliance.createError")));
      form.reset();
      setMessage(t("app.compliance.saved"));
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("app.compliance.createError"));
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(id: string, status: ObligationStatus) {
    setBusyId(id);
    setMessage("");
    try {
      const response = await fetch(`/api/compliance/obligations/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(localizeApiError(t, result.error, t("app.compliance.statusError")));
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("app.compliance.statusError"));
    } finally {
      setBusyId("");
    }
  }

  async function assignOwner(id: string, ownerUserId: string | null) {
    setBusyId(id);
    setMessage("");
    try {
      const response = await fetch(`/api/compliance/obligations/${id}/assignment`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerUserId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(localizeApiError(t, result.error, t("app.compliance.assignmentError")));
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("app.compliance.assignmentError"));
    } finally {
      setBusyId("");
    }
  }

  async function approveReview(id: string) {
    setBusyId(id);
    setMessage("");
    try {
      const response = await fetch(`/api/compliance/obligations/${id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(localizeApiError(t, result.error, t("app.compliance.reviewError")));
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("app.compliance.reviewError"));
    } finally {
      setBusyId("");
    }
  }

  async function attachEvidence(obligation: Obligation) {
    const documentId = selectedEvidence[obligation.id];
    if (!documentId) return;
    setBusyId(obligation.id);
    setMessage("");
    try {
      const response = await fetch(`/api/compliance/obligations/${obligation.id}/evidence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId,
          evidenceClass: "E1",
          sourceReference: evidenceSource[obligation.id] || undefined,
          validThrough: evidenceValidThrough[obligation.id] || null,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(localizeApiError(t, result.error, t("app.compliance.attachError")));
      setSelectedEvidence((current) => ({ ...current, [obligation.id]: "" }));
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("app.compliance.attachError"));
    } finally {
      setBusyId("");
    }
  }

  async function reviewEvidence(obligation: Obligation, evidenceId: string, reviewStatus: "VERIFIED" | "CHANGES_REQUESTED" | "REVOKED") {
    if (reviewStatus === "REVOKED" && !window.confirm(t("app.compliance.revokeEvidenceConfirm"))) return;
    const note = evidenceReviewNotes[evidenceId]?.trim();
    if (!note) {
      setMessage(t("app.compliance.addReviewNote"));
      return;
    }
    setBusyId(obligation.id);
    setMessage("");
    try {
      const response = await fetch(`/api/compliance/obligations/${obligation.id}/evidence/${evidenceId}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewStatus, note }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(localizeApiError(t, result.error, t("app.compliance.evidenceReviewError")));
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("app.compliance.evidenceReviewError"));
    } finally {
      setBusyId("");
    }
  }

  return (
    <section className="space-y-4">
      <header className="section-header">
        <div>
          <h2>{t("app.compliance.title")}</h2>
          <p>{t("app.compliance.workspaceScope")}</p>
        </div>
        <span className="text-sm text-slate-400">{t("app.compliance.total", { count: obligations.length })}</span>
      </header>

      {canManage ? (
        <details className="glass-panel p-5">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-white">
            <Plus size={16} aria-hidden="true" /> {t("app.compliance.add")}
          </summary>
          {clients.length ? (
            <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={createObligation}>
              <label className="space-y-2 text-sm text-slate-300">
                <span>{t("app.compliance.client")}</span>
                <select className="form-input" name="clientId" required defaultValue="">
                  <option value="" disabled>{t("app.compliance.selectClient")}</option>
                  {clients.map((client) => <option key={client.id} value={client.id}>{client.name || t("app.compliance.unnamedClient")}</option>)}
                </select>
              </label>
              <label className="space-y-2 text-sm text-slate-300">
                <span>{t("app.compliance.type")}</span>
                <select className="form-input" name="type" defaultValue="OTHER">
                  {OBLIGATION_TYPES.map((type) => <option key={type} value={type}>{t(obligationTypeKeys[type] ?? "app.compliance.typeOther")}</option>)}
                </select>
              </label>
              <label className="space-y-2 text-sm text-slate-300 sm:col-span-2">
                <span>{t("app.compliance.obligationTitle")}</span>
                <input className="form-input" name="title" minLength={2} maxLength={240} required />
              </label>
              <label className="space-y-2 text-sm text-slate-300">
                <span>{t("app.compliance.dueDate")}</span>
                <input className="form-input" name="dueAt" type="date" />
              </label>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 self-end pb-3 text-sm text-slate-300">
                <label className="flex items-center gap-2">
                  <input name="requiresEvidence" type="checkbox" className="accent-[#d6b66a]" />
                  {t("app.compliance.evidenceRequired")}
                </label>
                <label className="flex items-center gap-2">
                  <input name="professionalReviewRequired" type="checkbox" className="accent-[#d6b66a]" />
                  {t("app.compliance.reviewRequired")}
                </label>
              </div>
              <label className="space-y-2 text-sm text-slate-300 sm:col-span-2">
                <span>{t("app.compliance.notesLabel")}</span>
                <textarea className="form-input min-h-20" name="description" maxLength={4000} />
              </label>
              <div className="flex items-center justify-between gap-3 sm:col-span-2">
                <p role="status" className="text-sm text-slate-400">{message}</p>
                <button className="button button-primary gap-2" type="submit" disabled={saving}>
                  {saving ? <span className="animate-pulse">{t("app.compliance.saving")}</span> : <><Check size={16} /> {t("app.compliance.create")}</>}
                </button>
              </div>
            </form>
          ) : (
            <p className="mt-4 text-sm text-slate-400">{t("app.compliance.clientRequired")}</p>
          )}
        </details>
      ) : null}

      {message && !canManage ? <p role="status" className="text-sm text-rose-300">{message}</p> : null}

      {obligations.length === 0 ? (
        <div className="rounded-lg border border-dashed border-white/10 p-8 text-center text-sm text-slate-400">
          {t("app.compliance.empty")}
        </div>
      ) : (
        <div className="divide-y divide-white/10 border-y border-white/10">
          {obligations.map((obligation) => (
            <article key={obligation.id} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-medium text-white">{obligation.title}</h3>
                <p className="mt-1 text-xs text-slate-400">
                  {obligation.clientName || t("app.compliance.client")} · {obligationTypeKeys[obligation.type] ? t(obligationTypeKeys[obligation.type]) : obligation.type.replaceAll("_", " ")}
                  {obligation.dueAt ? ` · ${t("app.compliance.due")} ${formatDate(new Date(obligation.dueAt), locale, { dateStyle: "medium" })}` : ` · ${t("app.compliance.noDueDate")}`}
                </p>
              </div>
              <span className={`status-badge ${isOverdue(obligation) ? "status-danger" : "status-info"}`}>
                {isOverdue(obligation) ? t("app.status.overdue") : statusKeys[obligation.status] ? t(statusKeys[obligation.status]) : obligation.status.replaceAll("_", " ")}
              </span>
              {canReview && obligation.status === "IN_REVIEW" ? (
                <button
                  className="button gap-2"
                  type="button"
                  disabled={busyId === obligation.id}
                  onClick={() => approveReview(obligation.id)}
                >
                  <ShieldCheck size={14} /> {t("app.compliance.approveReview")}
                </button>
              ) : null}
              {(canManage || canReview) && obligation.requiresEvidence ? (
                <details className="text-xs text-slate-400 sm:col-span-3">
                  <summary className="cursor-pointer">{t("app.compliance.evidence", { count: obligation.evidence.length })}</summary>
                  <div className="mt-2 space-y-3">
                    {obligation.evidence.map((item) => (
                      <div key={item.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 p-3">
                        <span className={`status-badge ${item.validThrough && currentTime !== null && new Date(item.validThrough).getTime() < currentTime ? "status-danger" : item.reviewStatus === "VERIFIED" ? "status-success" : item.reviewStatus === "CHANGES_REQUESTED" ? "status-danger" : "status-info"}`}>
                          {item.evidenceClass} · {item.validThrough && currentTime !== null && new Date(item.validThrough).getTime() < currentTime ? t("app.compliance.expired") : evidenceReviewStatusKeys[item.reviewStatus] ? t(evidenceReviewStatusKeys[item.reviewStatus]) : item.reviewStatus.replaceAll("_", " ")}
                        </span>
                        {item.sourceReference ? <span>{t("app.compliance.source", { source: item.sourceReference })}</span> : <span>{t("app.compliance.sourceMissing")}</span>}
                        {item.validThrough
                          ? <span>{t("app.compliance.validThrough", { date: formatDate(new Date(item.validThrough), locale, { dateStyle: "medium" }) })}</span>
                          : <span>{t("app.compliance.validityMissing")}</span>}
                        {item.reviewNote ? <span>{t("app.compliance.reviewNote", { note: item.reviewNote })}</span> : null}
                        {canReview && item.reviewStatus !== "REVOKED" ? (
                          <>
                            <label className="sr-only" htmlFor={`evidence-review-${item.id}`}>{t("app.compliance.reviewNoteLabel")}</label>
                            <input
                              id={`evidence-review-${item.id}`}
                              className="form-input min-h-10 sm:w-64"
                              value={evidenceReviewNotes[item.id] ?? ""}
                              onChange={(event) => setEvidenceReviewNotes((current) => ({ ...current, [item.id]: event.target.value }))}
                              placeholder={t("app.compliance.reviewNoteLabel")}
                              maxLength={4000}
                            />
                            <button className="icon-button" type="button" disabled={busyId === obligation.id} onClick={() => reviewEvidence(obligation, item.id, "VERIFIED")}>
                              {t("app.compliance.verify")}
                            </button>
                            <button className="icon-button" type="button" disabled={busyId === obligation.id} onClick={() => reviewEvidence(obligation, item.id, "CHANGES_REQUESTED")}>
                              {t("app.compliance.requestChanges")}
                            </button>
                            <button className="icon-button" type="button" disabled={busyId === obligation.id} onClick={() => reviewEvidence(obligation, item.id, "REVOKED")}>
                              {t("app.compliance.revokeEvidence")}
                            </button>
                          </>
                        ) : null}
                      </div>
                    ))}
                    {canManage ? (
                    <div className="flex flex-wrap items-center gap-2">
                    <label className="sr-only" htmlFor={`evidence-${obligation.id}`}>{t("app.compliance.documentEvidence", { title: obligation.title })}</label>
                    <select
                      id={`evidence-${obligation.id}`}
                      className="form-input min-h-10 sm:w-64"
                      value={selectedEvidence[obligation.id] ?? ""}
                      onChange={(event) => setSelectedEvidence((current) => ({ ...current, [obligation.id]: event.target.value }))}
                    >
                      <option value="">{t("app.compliance.selectDocument")}</option>
                      {documents.filter((document) => document.clientId === obligation.clientId).map((document) => (
                        <option key={document.id} value={document.id}>{document.name}</option>
                      ))}
                    </select>
                    <label className="sr-only" htmlFor={`evidence-source-${obligation.id}`}>{t("app.compliance.sourceReference")}</label>
                    <input
                      id={`evidence-source-${obligation.id}`}
                      className="form-input min-h-10 sm:w-52"
                      value={evidenceSource[obligation.id] ?? ""}
                      onChange={(event) => setEvidenceSource((current) => ({ ...current, [obligation.id]: event.target.value }))}
                      placeholder={t("app.compliance.sourceReferenceOptional")}
                      maxLength={2000}
                    />
                    <label className="sr-only" htmlFor={`evidence-valid-${obligation.id}`}>{t("app.compliance.validThroughLabel")}</label>
                    <input
                      id={`evidence-valid-${obligation.id}`}
                      className="form-input min-h-10 sm:w-44"
                      type="date"
                      value={evidenceValidThrough[obligation.id] ?? ""}
                      onChange={(event) => setEvidenceValidThrough((current) => ({ ...current, [obligation.id]: event.target.value }))}
                    />
                    <button
                      className="icon-button"
                      type="button"
                      aria-label={t("app.compliance.attachEvidenceTo", { title: obligation.title })}
                      title={t("app.compliance.attachEvidence")}
                      disabled={busyId === obligation.id || !selectedEvidence[obligation.id]}
                      onClick={() => attachEvidence(obligation)}
                    >
                      <FileCheck2 size={15} />
                    </button>
                    </div>
                    ) : null}
                  </div>
                </details>
              ) : null}
              {canManage ? (
                <>
                <label className="sr-only" htmlFor={`owner-${obligation.id}`}>{t("app.compliance.assignOwnerFor", { title: obligation.title })}</label>
                <select
                  id={`owner-${obligation.id}`}
                  className="form-input min-h-10 sm:w-48"
                  value={obligation.ownerUserId ?? ""}
                  disabled={busyId === obligation.id}
                  onChange={(event) => assignOwner(obligation.id, event.target.value || null)}
                >
                  <option value="">{t("app.compliance.unassigned")}</option>
                  {teamMembers.map((member) => (
                    <option key={member.userId} value={member.userId}>{member.name}</option>
                  ))}
                </select>
                </>
              ) : null}
              {canManage ? (
                <label className="sr-only" htmlFor={`status-${obligation.id}`}>{t("app.compliance.updateStatusFor", { title: obligation.title })}</label>
              ) : null}
              {canManage ? (
                <select
                  id={`status-${obligation.id}`}
                  className="form-input min-h-10 sm:w-48"
                  value={obligation.status === "OVERDUE" || isOverdue(obligation) ? "IN_PROGRESS" : obligation.status}
                  disabled={busyId === obligation.id}
                  onChange={(event) => updateStatus(obligation.id, event.target.value as ObligationStatus)}
                >
                  {COMPLIANCE_STATUSES.filter((status) => status !== "OVERDUE").map((status) => (
                    <option key={status} value={status}>{statusKeys[status] ? t(statusKeys[status]) : status.replaceAll("_", " ")}</option>
                  ))}
                </select>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}