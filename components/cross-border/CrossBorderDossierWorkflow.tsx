"use client";

import { localizeApiError } from "@/lib/i18n/api-errors";
import { Check, Plus, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { MessageKey } from "@/lib/i18n/messages";

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
  const { t } = useLocale();
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
    if (!response.ok) throw new Error(localizeApiError(t, result.error, t("crossBorder.error.update")));
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
      setMessage(t("crossBorder.created"));
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("crossBorder.error.create"));
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
      setMessage(error instanceof Error ? error.message : t("crossBorder.error.addControl"));
    } finally {
      setBusyId("");
    }
  }

  async function attachEvidence(dossier: Dossier, control: Control) {
    const documentId = controlDocuments[control.id];
    if (!documentId) {
      setMessage(t("crossBorder.selectDocument"));
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
      setMessage(error instanceof Error ? error.message : t("crossBorder.error.attach"));
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
      setMessage(error instanceof Error ? error.message : t("crossBorder.error.updateControl"));
    } finally {
      setBusyId("");
    }
  }

  async function reviewDossier(dossier: Dossier, status: "REVIEWED" | "CHANGES_REQUESTED") {
    const note = reviewNotes[dossier.id]?.trim();
    if (!note) {
      setMessage(t("crossBorder.reviewNoteRequired"));
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
      setMessage(error instanceof Error ? error.message : t("crossBorder.error.review"));
    } finally {
      setBusyId("");
    }
  }

  return (
    <section className="space-y-5">
      {canManage ? (
        <details className="glass-panel p-5">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-white">
            <Plus size={16} aria-hidden="true" /> {t("crossBorder.create.summary")}
          </summary>
          <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={submitForm}>
            <label className="space-y-2 text-sm text-slate-300">
              <span>{t("crossBorder.create.client")}</span>
              <select className="form-input" name="clientId" required value={selectedClientId} onChange={(event) => setSelectedClientId(event.target.value)}>
                <option value="">{t("crossBorder.create.selectClient")}</option>
                {clients.map((client) => <option key={client.id} value={client.id}>{client.name || t("crossBorder.create.unnamedClient")}</option>)}
              </select>
            </label>
            <label className="space-y-2 text-sm text-slate-300">
              <span>{t("crossBorder.create.pathway")}</span>
              <select className="form-input" name="marketEntryPlanId" defaultValue="">
                <option value="">{t("crossBorder.create.noPathway")}</option>
                {marketEntryPlans.filter((plan) => plan.clientId === selectedClientId).map((plan) => <option key={plan.id} value={plan.id}>{plan.label}</option>)}
              </select>
            </label>
            <label className="space-y-2 text-sm text-slate-300">
              <span>{t("crossBorder.create.origin")}</span>
              <select className="form-input" name="originJurisdictionId" required defaultValue="">
                <option value="">{t("crossBorder.create.selectOrigin")}</option>
                {jurisdictions.map((jurisdiction) => <option key={jurisdiction.id} value={jurisdiction.id}>{jurisdiction.name}, {jurisdiction.country}</option>)}
              </select>
            </label>
            <label className="space-y-2 text-sm text-slate-300">
              <span>{t("crossBorder.create.destination")}</span>
              <select className="form-input" name="destinationJurisdictionId" required defaultValue="">
                <option value="">{t("crossBorder.create.selectDestination")}</option>
                {jurisdictions.map((jurisdiction) => <option key={jurisdiction.id} value={jurisdiction.id}>{jurisdiction.name}, {jurisdiction.country}</option>)}
              </select>
            </label>
            <label className="space-y-2 text-sm text-slate-300">
              <span>{t("crossBorder.create.counterparty")}</span>
              <input className="form-input" name="counterpartyName" required minLength={2} maxLength={240} />
            </label>
            <label className="space-y-2 text-sm text-slate-300">
              <span>{t("crossBorder.create.counterpartyCountry")}</span>
              <input className="form-input" name="counterpartyCountry" maxLength={120} />
            </label>
            <label className="space-y-2 text-sm text-slate-300 sm:col-span-2">
              <span>{t("crossBorder.create.activity")}</span>
              <textarea className="form-input min-h-20" name="activityDescription" required minLength={10} maxLength={4000} />
            </label>
            <label className="space-y-2 text-sm text-slate-300">
              <span>{t("crossBorder.create.currency")}</span>
              <input className="form-input" name="currencyCode" maxLength={3} pattern="[A-Za-z]{3}" />
            </label>
            <label className="space-y-2 text-sm text-slate-300">
              <span>{t("crossBorder.create.value")}</span>
              <input className="form-input" name="estimatedValue" inputMode="decimal" pattern="[0-9]+(\.[0-9]{1,2})?" />
            </label>
            <div className="flex items-center justify-between gap-3 sm:col-span-2">
              <p role="status" className="text-sm text-slate-400">{message}</p>
              <button className="button gap-2" disabled={busyId === "create"}><Check size={15} /> {t("crossBorder.create.submit")}</button>
            </div>
          </form>
        </details>
      ) : null}

      {message && !canManage ? <p role="status" className="text-sm text-rose-300">{message}</p> : null}
      {!dossiers.length ? (
        <div className="rounded-lg border border-dashed border-white/10 p-8 text-center text-sm text-slate-400">{t("crossBorder.list.empty")}</div>
      ) : (
        <div className="space-y-4">
          {dossiers.map((dossier) => (
            <article key={dossier.id} className="glass-panel space-y-4 p-5">
              <header className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-white">{dossier.clientName || t("crossBorder.dossier.clientFallback")} · {dossier.origin.country} → {dossier.destination.country}</h2>
                  <p className="mt-1 text-sm text-slate-400">{dossier.counterpartyName}{dossier.counterpartyCountry ? ` · ${dossier.counterpartyCountry}` : ""}</p>
                </div>
                <span className="status-badge status-info">{t(`crossBorder.status.${dossier.status}` as MessageKey)}</span>
              </header>
              <p className="text-sm text-slate-300">{dossier.activityDescription}</p>
              <p className="text-xs text-slate-500">
                {dossier.currencyCode ? `${dossier.currencyCode} ` : ""}{dossier.estimatedValue ?? t("crossBorder.dossier.valueNotRecorded")} · {t("crossBorder.dossier.version", { version: dossier.version })}
              </p>
              {dossier.reviewNote ? <p className="text-sm text-amber-200">{t("crossBorder.dossier.reviewNote", { note: dossier.reviewNote })}</p> : null}

              <div className="space-y-3 border-t border-white/10 pt-4">
                <h3 className="text-sm font-medium text-white">{t("crossBorder.controls.title", { count: dossier.controls.length })}</h3>
                {dossier.controls.map((control) => (
                  <div key={control.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 p-3">
                    <div className="min-w-48 flex-1">
                      <p className="text-sm text-white">{control.title}</p>
                      <p className="text-xs text-slate-400">{control.category}{control.requiresEvidence ? ` · ${t("crossBorder.controls.evidenceRequired")}` : ""}</p>
                    </div>
                    <span className="text-xs text-slate-400">
                      {control.evidence.map((item) => item.document.name).join(", ") || (control.requiresEvidence ? t("crossBorder.controls.evidenceMissing") : t("crossBorder.controls.noEvidence"))}
                    </span>
                    {canManage && control.requiresEvidence && !["REVIEWED", "ARCHIVED"].includes(dossier.status) ? (
                      <>
                        <select aria-label={t("crossBorder.controls.selectDocument")} className="form-input min-h-10 sm:w-56" value={controlDocuments[control.id] ?? ""} onChange={(event) => setControlDocuments((current) => ({ ...current, [control.id]: event.target.value }))}>
                          <option value="">{t("crossBorder.controls.selectDocument")}</option>
                          {documents.filter((document) => document.clientId === dossier.clientId).map((document) => <option key={document.id} value={document.id}>{document.name}</option>)}
                        </select>
                        <button className="icon-button" type="button" disabled={busyId === dossier.id || !controlDocuments[control.id]} onClick={() => attachEvidence(dossier, control)}>{t("crossBorder.controls.attach")}</button>
                      </>
                    ) : null}
                    {canManage && !["REVIEWED", "ARCHIVED"].includes(dossier.status) ? (
                      <select aria-label={t("crossBorder.controls.statusLabel")} className="form-input min-h-10 sm:w-48" value={control.status} disabled={busyId === dossier.id} onChange={(event) => updateControl(dossier, control, event.target.value)}>
                        {["NOT_ASSESSED", "IN_PROGRESS", "COMPLETE", "NOT_APPLICABLE"].map((status) => <option key={status} value={status} disabled={status === "NOT_ASSESSED"}>{t(`crossBorder.controlStatus.${status}` as MessageKey)}</option>)}
                      </select>
                    ) : <span className="status-badge status-info">{t(`crossBorder.controlStatus.${control.status}` as MessageKey)}</span>}
                  </div>
                ))}
                {canManage && !["REVIEWED", "ARCHIVED"].includes(dossier.status) ? (
                  <form className="grid gap-2 sm:grid-cols-2" onSubmit={(event) => addControl(event, dossier)}>
                    <input className="form-input" name="category" placeholder={t("crossBorder.controls.categoryPlaceholder")} required minLength={2} maxLength={100} />
                    <input className="form-input" name="title" placeholder={t("crossBorder.controls.titlePlaceholder")} required minLength={2} maxLength={240} />
                    <input className="form-input sm:col-span-2" name="description" placeholder={t("crossBorder.controls.descriptionPlaceholder")} maxLength={2000} />
                    <label className="flex items-center gap-2 text-sm text-slate-300">
                      <input name="requiresEvidence" type="checkbox" className="accent-[#d6b66a]" />
                      {t("crossBorder.controls.evidenceRequired")}
                    </label>
                    <button className="button gap-2 sm:col-span-2" disabled={busyId === dossier.id}><Plus size={14} /> {t("crossBorder.controls.add")}</button>
                  </form>
                ) : null}
              </div>

              {canReview && !["REVIEWED", "ARCHIVED"].includes(dossier.status) ? (
                <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
                  <label className="sr-only" htmlFor={`review-${dossier.id}`}>{t("crossBorder.review.noteLabel")}</label>
                  <input id={`review-${dossier.id}`} className="form-input min-h-10 flex-1" value={reviewNotes[dossier.id] ?? ""} onChange={(event) => setReviewNotes((current) => ({ ...current, [dossier.id]: event.target.value }))} placeholder={t("crossBorder.review.noteLabel")} maxLength={4000} />
                  <button className="button gap-2" disabled={busyId === dossier.id} onClick={() => reviewDossier(dossier, "REVIEWED")}><ShieldCheck size={14} /> {t("crossBorder.review.record")}</button>
                  <button className="icon-button" disabled={busyId === dossier.id} onClick={() => reviewDossier(dossier, "CHANGES_REQUESTED")}>{t("crossBorder.review.requestChanges")}</button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
