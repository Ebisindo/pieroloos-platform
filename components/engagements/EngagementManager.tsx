"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale } from "@/components/i18n/LocaleProvider";

type ClientOption = { id: string; name: string | null; organizationName: string | null; proposedBusiness: string | null };
type Activity = { id: string; type: string; title: string; summary: string | null; description: string | null; createdAt: string | Date };
type Engagement = {
  id: string;
  clientId: string;
  service: string;
  status: string;
  nextAction: string | null;
  notes: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  client: { id: string; name: string | null; organizationName: string | null; email?: string | null } | null;
  activities?: Activity[];
};

const statuses = ["DRAFT", "INTAKE", "ASSESSMENT", "PLANNING", "EXECUTION", "VERIFICATION", "RECORDING", "APPROVAL", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED", "ARCHIVED"];

export function EngagementManager({ initialEngagements, clients, canWrite }: {
  initialEngagements: Engagement[];
  clients: ClientOption[];
  canWrite: boolean;
}) {
  const { t } = useLocale();
  const router = useRouter();
  const [engagements, setEngagements] = useState(initialEngagements);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [clientId, setClientId] = useState("");
  const [service, setService] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return engagements.filter((item) =>
      (!status || item.status === status) &&
      (!term || [item.service, item.nextAction ?? "", item.client?.name ?? "", item.client?.organizationName ?? ""].some((value) => value.toLowerCase().includes(term))),
    );
  }, [engagements, query, status]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite || saving) return;
    setSaving(true); setMessage(""); setError(false);
    try {
      const response = await fetch("/api/engagements", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ clientId, service, nextAction: nextAction || undefined, notes: notes || undefined }),
      });
      const result = await response.json() as { error?: string; data?: Engagement };
      if (!response.ok || !result.data) throw new Error(result.error ?? t("engagements.createFailed"));
      setEngagements((current) => [result.data!, ...current]);
      setClientId(""); setService(""); setNextAction(""); setNotes("");
      setMessage(t("engagements.created"));
      router.refresh();
    } catch (err) {
      setError(true); setMessage(err instanceof Error ? err.message : t("engagements.createFailed"));
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 md:p-6" aria-labelledby="engagement-filter-heading">
        <h2 id="engagement-filter-heading" className="mb-4 text-lg font-semibold text-white">{t("engagements.filters")}</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block space-y-2"><span className="text-sm font-medium text-slate-200">{t("engagements.search")}</span><input value={query} onChange={(event) => setQuery(event.target.value)} type="search" className="min-h-11 w-full rounded-xl border border-white/15 bg-slate-950/70 px-4 py-3 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300" /></label>
          <label className="block space-y-2"><span className="text-sm font-medium text-slate-200">{t("engagements.statusFilter")}</span><select value={status} onChange={(event) => setStatus(event.target.value)} className="min-h-11 w-full rounded-xl border border-white/15 bg-slate-950/70 px-4 py-3 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"><option value="">{t("engagements.allStatuses")}</option>{statuses.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</select></label>
        </div>
      </section>
      {canWrite ? (
        <details className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 md:p-6">
          <summary className="cursor-pointer rounded-lg text-base font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300">{t("engagements.newEngagement")}</summary>
          {clients.length ? (
            <form className="mt-5 space-y-4" onSubmit={create}>
              <label className="block space-y-2"><span className="text-sm font-medium text-slate-200">{t("engagements.client")}</span><select required value={clientId} onChange={(event) => setClientId(event.target.value)} className="min-h-11 w-full rounded-xl border border-white/15 bg-slate-950/70 px-4 py-3 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"><option value="">{t("engagements.chooseClient")}</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.organizationName ?? client.name ?? client.proposedBusiness ?? client.id}</option>)}</select></label>
              <label className="block space-y-2"><span className="text-sm font-medium text-slate-200">{t("engagements.service")}</span><input required minLength={2} maxLength={200} value={service} onChange={(event) => setService(event.target.value)} className="min-h-11 w-full rounded-xl border border-white/15 bg-slate-950/70 px-4 py-3 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300" /></label>
              <label className="block space-y-2"><span className="text-sm font-medium text-slate-200">{t("engagements.nextAction")}</span><textarea rows={2} maxLength={2000} value={nextAction} onChange={(event) => setNextAction(event.target.value)} className="w-full rounded-xl border border-white/15 bg-slate-950/70 px-4 py-3 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300" /></label>
              <label className="block space-y-2"><span className="text-sm font-medium text-slate-200">{t("engagements.notes")}</span><textarea rows={3} maxLength={5000} value={notes} onChange={(event) => setNotes(event.target.value)} className="w-full rounded-xl border border-white/15 bg-slate-950/70 px-4 py-3 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300" /></label>
              <button disabled={saving} type="submit" className="min-h-11 w-full rounded-xl border border-amber-300/30 bg-amber-300/10 px-5 py-3 text-sm font-semibold text-amber-100 hover:bg-amber-300/15 disabled:opacity-50 sm:w-auto">{saving ? t("engagements.creating") : t("engagements.create")}</button>
            </form>
          ) : <p className="mt-4 text-sm leading-6 text-slate-300">{t("engagements.noClients")}</p>}
        </details>
      ) : null}
      <div aria-live="polite" role={error ? "alert" : "status"} className="text-sm text-slate-200">{message}</div>
      {visible.length === 0 ? <div className="rounded-2xl border border-dashed border-white/15 p-7 text-sm leading-6 text-slate-300">{engagements.length === 0 ? t("engagements.noEngagements") : t("engagements.noResults")}</div> : (
        <div className="grid gap-4 lg:grid-cols-2">
          {visible.map((item) => (
            <article key={item.id} className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.035] p-5">
              <div className="flex flex-wrap items-start justify-between gap-3"><span className="rounded-full border border-cyan-300/20 bg-cyan-300/[0.06] px-3 py-1 text-xs font-medium text-cyan-100">{item.status.replaceAll("_", " ")}</span><span className="text-xs text-slate-400">{t("engagements.updatedAt", { date: new Date(item.updatedAt).toLocaleDateString() })}</span></div>
              <h3 className="mt-4 break-words text-lg font-semibold text-white">{item.service}</h3>
              <p className="mt-1 break-words text-sm text-slate-300">{item.client?.organizationName ?? item.client?.name ?? t("engagements.clientUnavailable")}</p>
              <p className="mt-3 break-words text-sm leading-6 text-slate-300">{item.nextAction ?? t("engagements.noNextAction")}</p>
              <Link href={`/engagements/${encodeURIComponent(item.id)}`} className="mt-4 inline-flex min-h-11 items-center rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-white/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300">{t("engagements.open")}</Link>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
