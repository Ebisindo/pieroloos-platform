"use client";

import { Check, Plus, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type ClientOption = { id: string; name: string };
type JurisdictionOption = { id: string; name: string; country: string };
type DocumentOption = { id: string; name: string; clientId: string };
type ControlEvidence = { document: { id: string; name: string } };
type Control = {
  id: string;
  category: string;
  title: string;
  description: string | null;
  status: string;
  requiresEvidence: boolean;
  evidence: ControlEvidence[];
};
type Dossier = {
  id: string;
  clientId: string;
  clientName: string;
  counterpartyName: string;
  counterpartyCountry: string | null;
  activityDescription: string;
  currencyCode: string | null;
  estimatedValue: string | null;
  status: string;
  version: number;
  reviewNote: string | null;
  origin: JurisdictionOption;
  destination: JurisdictionOption;
  controls: Control[];
};
type EntryPlanOption = { id: string; clientId: string; targetJurisdictionId: string; label: string };

export function CrossBorderDossierWorkflow({
  dossiers,
  clients,
  jurisdictions,
  documents,
  marketEntryPlans,
  canManage,
  canReview,
}: {
  dossiers: Dossier[];
  clients: ClientOption[];
  jurisdictions: JurisdictionOption[];
  documents: DocumentOption[];
  marketEntryPlans: EntryPlanOption[];
  canManage: boolean;
  canReview: boolean;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [controlDocuments, setControlDocuments] = useState<Record<string, string>>({});
  const [controlNotes, setControlNotes] = useState<Record<string, string>>({});
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  async function send(url: string, method: "POST" | "PATCH", body: unknown) {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Unable to update cross-border dossier.");
  }

  async function submitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusyId("create");
    setMessage("");
    try {
      await send("/api/cross-border/dossiers", "POST", {
        clientId: data.get("clientId"),
        marketEntryPlanId: data.get("marketEntryPlanId") || null,
        originJurisdictionId: data.get("originJurisdictionId"),
        destinationJurisdictionId: data.get("destinationJurisdictionId"),
        counterpartyName: data.get("counterpartyName"),
        counterpartyCountry: data.get("counterpartyCountry") || undefined,
        activityDescription: data.get("activityDescription"),
        currencyCode: data.get("currencyCode") || undefined,
        estimatedValue: data.get("estimatedValue") || undefined,
      });
      form.reset();
      setSelectedClientId("");
      setMessage("Preparation dossier created.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create dossier.");
    } finally {
      setBusyId("");
    }
  }

  async function addControl(event: React.FormEvent<HTMLFormElement>, dossier: Dossier) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusyId(dossier.id);
    setMessage("");
    try {
      await send(`/api/cross-border/dossiers/${dossier.id}/controls`, "POST", {
        category: data.get("category"),
        title: data.get("title"),
        description: data.get("description") || undefined,
        requiresEvidence: data.get("requiresEvidence") === "on",
        expectedVersion: dossier.version,
      });
      form.reset();
      setControlDocuments((current) => ({ ...current, [dossier.id]: "" }));
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to add control.");
    } finally {
      setBusyId("");
    }
  }

  async function attachEvidence(dossier: Dossier, control: Control) {
    const documentId = controlDocuments[control.id];
    if (!documentId) {
      setMessage("Select a document before attaching evidence.");
      return;
    }
    setBusyId(dossier.id);
    setMessage("");
    try {
      await send(`/api/cross-border/dossiers/${dossier.id}/controls/${control.id}/evidence`, "POST", {
        documentId,
        expectedVersion: dossier.version,
      });
      setControlDocuments((current) => ({ ...current, [control.id]: "" }));
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to attach evidence.");
    } finally {
      setBusyId("");
    }
  }

  async function updateControl(dossier: Dossier, control: Control, status: string) {
    setBusyId(dossier.id);
    setMessage("");
    try {
      await send(`/api/cross-border/dossiers/${dossier.id}/controls/${control.id}`, "PATCH", {
        status,
        expectedVersion: dossier.version,
      });
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update control.");
    } finally {
      setBusyId("");
    }
  }

  async function reviewDossier(dossier: Dossier, status: "REVIEWED" | "CHANGES_REQUESTED") {
    const note = reviewNotes[dossier.id]?.trim();
    if (!note) {
      setMessage("Add a professional review note before recording an outcome.");
      return;
    }
    setBusyId(dossier.id);
    setMessage("");
    try {
      await send(`/api/cross-border/dossiers/${dossier.id}/review`, "POST", {
        status,
        note,
        expectedVersion: dossier.version,
      });
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to record review.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <section className="space-y-5">
      {canManage ? (
        <details className="glass-panel p-5">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-white">
            <Plus size={16} aria-hidden="true" /> Create preparation dossier
          </summary>
          <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={submitForm}>
            <label className="space-y-2 text-sm text-slate-300">
              <span>Client</span>
              <select className="form-input" name="clientId" required value={selectedClientId} onChange={(event) => setSelectedClientId(event.target.value)}>
                <option value="">Select a client</option>
                {clients.map((client) => <option key={client.id} value={client.id}>{client.name || "Unnamed client"}</option>)}
              </select>
            </label>
            <label className="space-y-2 text-sm text-slate-300">
              <span>Related market-entry pathway (optional)</span>
              <select className="form-input" name="marketEntryPlanId" defaultValue="">
                <option value="">No linked pathway</option>
                {marketEntryPlans.filter((plan) => plan.clientId === selectedClientId).map((plan) => <option key={plan.id} value={plan.id}>{plan.label}</option>)}
              </select>
            </label>
            <label className="space-y-2 text-sm text-slate-300">
              <span>Origin jurisdiction</span>
              <select className="form-input" name="originJurisdictionId" required defaultValue="">
                <option value="">Select origin</option>
                {jurisdictions.map((jurisdiction) => <option key={jurisdiction.id} value={jurisdiction.id}>{jurisdiction.name}, {jurisdiction.country}</option>)}
              </select>
            </label>
            <label className="space-y-2 text-sm text-slate-300">
              <span>Destination jurisdiction</span>
              <select className="form-input" name="destinationJurisdictionId" required defaultValue="">
                <option value="">Select destination</option>
                {jurisdictions.map((jurisdiction) => <option key={jurisdiction.id} value={jurisdiction.id}>{jurisdiction.name}, {jurisdiction.country}</option>)}
              </select>
            </label>
            <label className="space-y-2 text-sm text-slate-300">
              <span>Counterparty name</span>
              <input className="form-input" name="counterpartyName" required minLength={2} maxLength={240} />
            </label>
            <label className="space-y-2 text-sm text-slate-300">
              <span>Counterparty country (user-provided)</span>
              <input className="form-input" name="counterpartyCountry" maxLength={120} />
            </label>
            <label className="space-y-2 text-sm text-slate-300 sm:col-span-2">
              <span>Goods, services, or activity being prepared</span>
              <textarea className="form-input min-h-20" name="activityDescription" required minLength={10} maxLength={4000} />
            </label>
            <label className="space-y-2 text-sm text-slate-300">
              <span>Currency code (optional)</span>
              <input className="form-input" name="currencyCode" maxLength={3} pattern="[A-Za-z]{3}" />
            </label>
            <label className="space-y-2 text-sm text-slate-300">
              <span>Estimated value (optional)</span>
              <input className="form-input" name="estimatedValue" inputMode="decimal" pattern="[0-9]+(\.[0-9]{1,2})?" />
            </label>
            <div className="flex items-center justify-between gap-3 sm:col-span-2">
              <p role="status" className="text-sm text-slate-400">{message}</p>
              <button className="button gap-2" disabled={busyId === "create"}><Check size={15} /> Create dossier</button>
            </div>
          </form>
        </details>
      ) : null}

      {message && !canManage ? <p role="status" className="text-sm text-rose-300">{message}</p> : null}
      {!dossiers.length ? (
        <div className="rounded-lg border border-dashed border-white/10 p-8 text-center text-sm text-slate-400">No cross-border preparation dossiers have been created.</div>
      ) : (
        <div className="space-y-4">
          {dossiers.map((dossier) => (
            <article key={dossier.id} className="glass-panel space-y-4 p-5">
              <header className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-white">{dossier.clientName || "Client"} · {dossier.origin.country} → {dossier.destination.country}</h2>
                  <p className="mt-1 text-sm text-slate-400">{dossier.counterpartyName}{dossier.counterpartyCountry ? ` · ${dossier.counterpartyCountry}` : ""}</p>
                </div>
                <span className="status-badge status-info">{dossier.status.replaceAll("_", " ")}</span>
              </header>
              <p className="text-sm text-slate-300">{dossier.activityDescription}</p>
              <p className="text-xs text-slate-500">
                {dossier.currencyCode ? `${dossier.currencyCode} ` : ""}{dossier.estimatedValue ?? "Value not recorded"} · Version {dossier.version}
              </p>
              {dossier.reviewNote ? <p className="text-sm text-amber-200">Review note: {dossier.reviewNote}</p> : null}

              <div className="space-y-3 border-t border-white/10 pt-4">
                <h3 className="text-sm font-medium text-white">Preparation controls ({dossier.controls.length})</h3>
                {dossier.controls.map((control) => (
                  <div key={control.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 p-3">
                    <div className="min-w-48 flex-1">
                      <p className="text-sm text-white">{control.title}</p>
                      <p className="text-xs text-slate-400">{control.category}{control.requiresEvidence ? " · Evidence required" : ""}</p>
                    </div>
                    <span className="text-xs text-slate-400">
                      {control.evidence.map((item) => item.document.name).join(", ") || (control.requiresEvidence ? "Evidence missing" : "No evidence linked")}
                    </span>
                    {canManage && control.requiresEvidence && !["REVIEWED", "ARCHIVED"].includes(dossier.status) ? (
                      <>
                        <select className="form-input min-h-10 sm:w-56" value={controlDocuments[control.id] ?? ""} onChange={(event) => setControlDocuments((current) => ({ ...current, [control.id]: event.target.value }))}>
                          <option value="">Select client document</option>
                          {documents.filter((document) => document.clientId === dossier.clientId).map((document) => <option key={document.id} value={document.id}>{document.name}</option>)}
                        </select>
                        <button className="icon-button" type="button" disabled={busyId === dossier.id || !controlDocuments[control.id]} onClick={() => attachEvidence(dossier, control)}>Attach evidence</button>
                      </>
                    ) : null}
                    {canManage && !["REVIEWED", "ARCHIVED"].includes(dossier.status) ? (
                      <select className="form-input min-h-10 sm:w-48" value={control.status} disabled={busyId === dossier.id} onChange={(event) => updateControl(dossier, control, event.target.value)}>
                        {["NOT_ASSESSED", "IN_PROGRESS", "COMPLETE", "NOT_APPLICABLE"].map((status) => <option key={status} value={status} disabled={status === "NOT_ASSESSED"}>{status.replaceAll("_", " ")}</option>)}
                      </select>
                    ) : <span className="status-badge status-info">{control.status.replaceAll("_", " ")}</span>}
                  </div>
                ))}
                {canManage && !["REVIEWED", "ARCHIVED"].includes(dossier.status) ? (
                  <form className="grid gap-2 sm:grid-cols-2" onSubmit={(event) => addControl(event, dossier)}>
                    <input className="form-input" name="category" placeholder="Category (e.g. documentation)" required minLength={2} maxLength={100} />
                    <input className="form-input" name="title" placeholder="User-defined control" required minLength={2} maxLength={240} />
                    <input className="form-input sm:col-span-2" name="description" placeholder="Notes or professional source reference (optional)" maxLength={2000} />
                    <label className="flex items-center gap-2 text-sm text-slate-300">
                      <input name="requiresEvidence" type="checkbox" className="accent-[#d6b66a]" />
                      Evidence required
                    </label>
                    <button className="button gap-2 sm:col-span-2" disabled={busyId === dossier.id}><Plus size={14} /> Add control</button>
                  </form>
                ) : null}
              </div>

              {canReview && !["REVIEWED", "ARCHIVED"].includes(dossier.status) ? (
                <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
                  <label className="sr-only" htmlFor={`review-${dossier.id}`}>Professional review note</label>
                  <input id={`review-${dossier.id}`} className="form-input min-h-10 flex-1" value={reviewNotes[dossier.id] ?? ""} onChange={(event) => setReviewNotes((current) => ({ ...current, [dossier.id]: event.target.value }))} placeholder="Professional review note" maxLength={4000} />
                  <button className="button gap-2" disabled={busyId === dossier.id} onClick={() => reviewDossier(dossier, "REVIEWED")}><ShieldCheck size={14} /> Record review</button>
                  <button className="icon-button" disabled={busyId === dossier.id} onClick={() => reviewDossier(dossier, "CHANGES_REQUESTED")}>Request changes</button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
