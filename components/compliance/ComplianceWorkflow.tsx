"use client";

import { Check, FileCheck2, Plus, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { COMPLIANCE_STATUSES, OBLIGATION_TYPES } from "@/lib/domain/compliance";

type ObligationStatus = Exclude<(typeof COMPLIANCE_STATUSES)[number], "OVERDUE">;

type Obligation = {
  id: string;
  clientId: string;
  clientName: string;
  title: string;
  type: string;
  status: string;
  dueAt: string | null;
  requiresEvidence: boolean;
  evidence: Array<{ id: string; documentId: string; evidenceClass: string }>;
};

type ClientOption = { id: string; name: string };
type DocumentOption = { id: string; name: string; clientId: string };
const terminalStatuses = new Set(["COMPLETE", "COMPLETED", "COMPLIANT", "WAIVED", "NOT_APPLICABLE"]);

export function ComplianceWorkflow({
  obligations,
  clients,
  documents,
  canManage,
  canReview,
}: {
  obligations: Obligation[];
  clients: ClientOption[];
  documents: DocumentOption[];
  canManage: boolean;
  canReview: boolean;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedEvidence, setSelectedEvidence] = useState<Record<string, string>>({});
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
      if (!response.ok) throw new Error(result.error ?? "Unable to create obligation.");
      form.reset();
      setMessage("Obligation created.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create obligation.");
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
      if (!response.ok) throw new Error(result.error ?? "Unable to update status.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update status.");
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
      if (!response.ok) throw new Error(result.error ?? "Unable to approve review.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to approve review.");
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
        body: JSON.stringify({ documentId, evidenceClass: "E1" }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to attach evidence.");
      setSelectedEvidence((current) => ({ ...current, [obligation.id]: "" }));
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to attach evidence.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <section className="space-y-4">
      <header className="section-header">
        <div>
          <h2>Obligations</h2>
          <p>Workspace-scoped deadlines, ownership, and completion status.</p>
        </div>
        <span className="text-sm text-slate-400">{obligations.length} total</span>
      </header>

      {canManage ? (
        <details className="glass-panel p-5">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-white">
            <Plus size={16} aria-hidden="true" /> Add obligation
          </summary>
          {clients.length ? (
            <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={createObligation}>
              <label className="space-y-2 text-sm text-slate-300">
                <span>Client</span>
                <select className="form-input" name="clientId" required defaultValue="">
                  <option value="" disabled>Select a client</option>
                  {clients.map((client) => <option key={client.id} value={client.id}>{client.name || "Unnamed client"}</option>)}
                </select>
              </label>
              <label className="space-y-2 text-sm text-slate-300">
                <span>Obligation type</span>
                <select className="form-input" name="type" defaultValue="OTHER">
                  {OBLIGATION_TYPES.map((type) => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}
                </select>
              </label>
              <label className="space-y-2 text-sm text-slate-300 sm:col-span-2">
                <span>Title</span>
                <input className="form-input" name="title" minLength={2} maxLength={240} required />
              </label>
              <label className="space-y-2 text-sm text-slate-300">
                <span>Due date</span>
                <input className="form-input" name="dueAt" type="date" />
              </label>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 self-end pb-3 text-sm text-slate-300">
                <label className="flex items-center gap-2">
                  <input name="requiresEvidence" type="checkbox" className="accent-[#d6b66a]" />
                  Evidence required
                </label>
                <label className="flex items-center gap-2">
                  <input name="professionalReviewRequired" type="checkbox" className="accent-[#d6b66a]" />
                  Professional review required
                </label>
              </div>
              <label className="space-y-2 text-sm text-slate-300 sm:col-span-2">
                <span>Notes</span>
                <textarea className="form-input min-h-20" name="description" maxLength={4000} />
              </label>
              <div className="flex items-center justify-between gap-3 sm:col-span-2">
                <p role="status" className="text-sm text-slate-400">{message}</p>
                <button className="button button-primary gap-2" type="submit" disabled={saving}>
                  {saving ? <span className="animate-pulse">Saving</span> : <><Check size={16} /> Create obligation</>}
                </button>
              </div>
            </form>
          ) : (
            <p className="mt-4 text-sm text-slate-400">Add a client before creating an obligation.</p>
          )}
        </details>
      ) : null}

      {message && !canManage ? <p role="status" className="text-sm text-rose-300">{message}</p> : null}

      {obligations.length === 0 ? (
        <div className="rounded-lg border border-dashed border-white/10 p-8 text-center text-sm text-slate-400">
          No obligations have been recorded for this workspace.
        </div>
      ) : (
        <div className="divide-y divide-white/10 border-y border-white/10">
          {obligations.map((obligation) => (
            <article key={obligation.id} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-medium text-white">{obligation.title}</h3>
                <p className="mt-1 text-xs text-slate-400">
                  {obligation.clientName || "Client"} · {obligation.type.replaceAll("_", " ")}
                  {obligation.dueAt ? ` · Due ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(obligation.dueAt))}` : " · No due date"}
                </p>
              </div>
              <span className={`status-badge ${isOverdue(obligation) ? "status-danger" : "status-info"}`}>
                {isOverdue(obligation) ? "OVERDUE" : obligation.status.replaceAll("_", " ")}
              </span>
              {canReview && obligation.status === "IN_REVIEW" ? (
                <button
                  className="button gap-2"
                  type="button"
                  disabled={busyId === obligation.id}
                  onClick={() => approveReview(obligation.id)}
                >
                  <ShieldCheck size={14} /> Approve review
                </button>
              ) : null}
              {canManage && obligation.requiresEvidence ? (
                <details className="text-xs text-slate-400 sm:col-span-3">
                  <summary className="cursor-pointer">Evidence ({obligation.evidence.length})</summary>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {obligation.evidence.map((item) => (
                      <span key={item.id} className="status-badge status-success">{item.evidenceClass}</span>
                    ))}
                    <label className="sr-only" htmlFor={`evidence-${obligation.id}`}>Document evidence for {obligation.title}</label>
                    <select
                      id={`evidence-${obligation.id}`}
                      className="form-input min-h-10 sm:w-64"
                      value={selectedEvidence[obligation.id] ?? ""}
                      onChange={(event) => setSelectedEvidence((current) => ({ ...current, [obligation.id]: event.target.value }))}
                    >
                      <option value="">Select client document</option>
                      {documents.filter((document) => document.clientId === obligation.clientId).map((document) => (
                        <option key={document.id} value={document.id}>{document.name}</option>
                      ))}
                    </select>
                    <button
                      className="icon-button"
                      type="button"
                      aria-label={`Attach evidence to ${obligation.title}`}
                      title="Attach evidence"
                      disabled={busyId === obligation.id || !selectedEvidence[obligation.id]}
                      onClick={() => attachEvidence(obligation)}
                    >
                      <FileCheck2 size={15} />
                    </button>
                  </div>
                </details>
              ) : null}
              {canManage ? (
                <label className="sr-only" htmlFor={`status-${obligation.id}`}>Update status for {obligation.title}</label>
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
                    <option key={status} value={status}>{status.replaceAll("_", " ")}</option>
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