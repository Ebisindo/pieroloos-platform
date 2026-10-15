"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { getNextStatuses, type EngagementStatus } from "@/lib/domain/engagement";
import { useLocale } from "@/components/i18n/LocaleProvider";

type Activity = { id: string; type: string; title: string; summary: string | null; description: string | null; createdAt: string | Date; actor?: { name: string | null; email: string } | null };
type Engagement = {
  id: string; service: string; status: EngagementStatus; nextAction: string | null; notes: string | null;
  createdAt: string | Date; updatedAt: string | Date;
  client: { id: string; name: string | null; organizationName: string | null; email?: string | null; businessProfile?: { businessName: string | null } | null } | null;
  activities: Activity[];
};

export function EngagementDetailEditor({ initialEngagement, canWrite }: { initialEngagement: Engagement; canWrite: boolean }) {
  const { t } = useLocale();
  const [engagement, setEngagement] = useState(initialEngagement);
  const [service, setService] = useState(initialEngagement.service);
  const [nextAction, setNextAction] = useState(initialEngagement.nextAction ?? "");
  const [notes, setNotes] = useState(initialEngagement.notes ?? "");
  const [toStatus, setToStatus] = useState<EngagementStatus | "">(getNextStatuses(initialEngagement.status)[0] ?? "");
  const [transitionNote, setTransitionNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  async function saveDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite || saving) return;
    setSaving(true); setMessage(""); setError(false);
    try {
      const response = await fetch(`/api/engagements/${encodeURIComponent(engagement.id)}`, {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ service, nextAction: nextAction || null, notes: notes || null }),
      });
      const result = await response.json() as { error?: string; data?: Engagement };
      if (!response.ok || !result.data) throw new Error(result.error ?? t("engagements.saveFailed"));
      setEngagement(result.data);
      setMessage(t("engagements.detailsSaved"));
    } catch (err) {
      setError(true); setMessage(err instanceof Error ? err.message : t("engagements.saveFailed"));
    } finally { setSaving(false); }
  }

  async function changeStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite || saving || !toStatus) return;
    setSaving(true); setMessage(""); setError(false);
    try {
      const response = await fetch(`/api/engagements/${encodeURIComponent(engagement.id)}/transition`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ toStatus, note: transitionNote.trim() || undefined }),
      });
      const result = await response.json() as { error?: string; data?: Engagement };
      if (!response.ok || !result.data) throw new Error(result.error ?? t("engagements.transitionFailed"));
      setEngagement(result.data);
      setToStatus(getNextStatuses(result.data.status)[0] ?? "");
      setTransitionNote("");
      setMessage(t("engagements.statusChanged"));
    } catch (err) {
      setError(true); setMessage(err instanceof Error ? err.message : t("engagements.transitionFailed"));
    } finally { setSaving(false); }
  }

  const allowed = getNextStatuses(engagement.status);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wider text-cyan-200">{engagement.status.replaceAll("_", " ")}</p><h2 className="mt-2 break-words text-xl font-semibold text-white">{engagement.service}</h2><p className="mt-2 text-sm text-slate-300">{engagement.client?.organizationName ?? engagement.client?.name ?? t("engagements.clientUnavailable")}</p><p className="mt-1 text-xs text-slate-400">{t("engagements.updatedAtLabel", { date: new Date(engagement.updatedAt).toLocaleString() })}</p></div>
          <Link href="/engagements" className="inline-flex min-h-11 items-center rounded-lg border border-white/15 px-4 py-2 text-sm text-cyan-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300">{t("engagements.back")}</Link>
        </div>
      </section>
      <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 md:p-6">
        <h2 className="text-lg font-semibold text-white">{t("engagements.editTitle")}</h2>
        <form className="mt-4 space-y-4" onSubmit={saveDetails}>
          <label className="block space-y-2"><span className="text-sm font-medium text-slate-200">{t("engagements.service")}</span><input required minLength={2} maxLength={200} disabled={!canWrite || saving} value={service} onChange={(event) => setService(event.target.value)} className="min-h-11 w-full rounded-xl border border-white/15 bg-slate-950/70 px-4 py-3 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300 disabled:opacity-70" /></label>
          <label className="block space-y-2"><span className="text-sm font-medium text-slate-200">{t("engagements.nextAction")}</span><textarea rows={3} maxLength={2000} disabled={!canWrite || saving} value={nextAction} onChange={(event) => setNextAction(event.target.value)} className="w-full rounded-xl border border-white/15 bg-slate-950/70 px-4 py-3 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300 disabled:opacity-70" /></label>
          <label className="block space-y-2"><span className="text-sm font-medium text-slate-200">{t("engagements.notes")}</span><textarea rows={4} maxLength={5000} disabled={!canWrite || saving} value={notes} onChange={(event) => setNotes(event.target.value)} className="w-full rounded-xl border border-white/15 bg-slate-950/70 px-4 py-3 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300 disabled:opacity-70" /></label>
          {canWrite ? <button disabled={saving} type="submit" className="min-h-11 rounded-xl border border-amber-300/30 bg-amber-300/10 px-5 py-3 text-sm font-semibold text-amber-100 hover:bg-amber-300/15 disabled:opacity-50">{saving ? t("engagements.saving") : t("engagements.save")}</button> : <p className="text-sm text-slate-300">{t("profile.readOnly")}</p>}
        </form>
      </section>
      {canWrite ? <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 md:p-6">
        <h2 className="text-lg font-semibold text-white">{t("engagements.changeStatus")}</h2>
        {allowed.length ? <form onSubmit={changeStatus} className="mt-4 space-y-4">
          <label className="block space-y-2"><span className="text-sm font-medium text-slate-200">{t("engagements.changeStatus")}</span><select required value={toStatus} onChange={(event) => setToStatus(event.target.value as EngagementStatus)} className="min-h-11 w-full rounded-xl border border-white/15 bg-slate-950/70 px-4 py-3 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300">{allowed.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select></label>
          <label className="block space-y-2"><span className="text-sm font-medium text-slate-200">{t("engagements.transitionNote")}</span><textarea rows={2} maxLength={2000} value={transitionNote} onChange={(event) => setTransitionNote(event.target.value)} className="w-full rounded-xl border border-white/15 bg-slate-950/70 px-4 py-3 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300" /></label>
          <button disabled={saving || !toStatus} type="submit" className="min-h-11 rounded-xl border border-cyan-300/25 bg-cyan-300/[0.07] px-5 py-3 text-sm font-semibold text-cyan-100 hover:bg-cyan-300/[0.12] disabled:opacity-50">{t("engagements.transition")}</button>
        </form> : <p className="mt-3 text-sm leading-6 text-slate-300">{t("engagements.noAllowedTransitions")}</p>}
      </section> : null}
      <p aria-live="polite" role={error ? "alert" : "status"} className="text-sm text-slate-200">{message}</p>
      <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 md:p-6" aria-labelledby="engagement-history-heading">
        <h2 id="engagement-history-heading" className="text-lg font-semibold text-white">{t("engagements.activity")}</h2>
        {engagement.activities.length ? <ol className="mt-4 space-y-4">{engagement.activities.map((activity) => <li key={activity.id} className="border-l-2 border-cyan-300/20 pl-4"><p className="break-words text-sm font-semibold text-white">{activity.title}</p>{activity.summary || activity.description ? <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-slate-300">{activity.summary ?? activity.description}</p> : null}<p className="mt-2 text-xs text-slate-400">{new Date(activity.createdAt).toLocaleString()}</p></li>)}</ol> : <p className="mt-4 text-sm leading-6 text-slate-300">{t("engagements.noActivity")}</p>}
      </section>
    </div>
  );
}
