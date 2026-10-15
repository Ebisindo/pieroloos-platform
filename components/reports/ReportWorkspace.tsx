"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/components/i18n/LocaleProvider";

type ClientOption = { id: string; name: string | null; organizationName: string | null; proposedBusiness: string | null };
type ReportSection = { id: string; title: string; content: string; evidenceIds?: string[] };
type ReportDocument = { title: string; clientId: string; generatedAt: string; sections: ReportSection[]; disclaimer: string };
type SavedReport = {
  id: string; title: string; format: string | null; status: string | null; createdAt: string | Date;
  content: string | null;
  document: ReportDocument | null;
  client: { id: string; name: string | null; organizationName: string | null } | null;
};

export function ReportWorkspace({ initialReports, clients, canWrite }: {
  initialReports: SavedReport[];
  clients: ClientOption[];
  canWrite: boolean;
}) {
  const { t } = useLocale();
  const router = useRouter();
  const [reports, setReports] = useState(initialReports);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedReportId, setSelectedReportId] = useState(initialReports[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  const selectedReport = useMemo(() => reports.find((report) => report.id === selectedReportId) ?? null, [reports, selectedReportId]);

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite || saving) return;
    setSaving(true); setMessage(""); setError(false);
    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clientId: selectedClientId }),
      });
      const result = await response.json() as { error?: string; data?: { id: string; title: string; createdAt: string; document: ReportDocument } };
      if (!response.ok || !result.data) throw new Error(result.error ?? t("reports.generateFailed"));
      const generated: SavedReport = {
        id: result.data.id,
        title: result.data.title,
        format: "PIEROLOOS_CLIENT_SUMMARY_V1",
        status: "GENERATED",
        createdAt: result.data.createdAt,
        content: JSON.stringify(result.data.document),
        document: result.data.document,
        client: clients.find((client) => client.id === selectedClientId) ?? null,
      };
      setReports((current) => [generated, ...current]);
      setSelectedReportId(generated.id);
      setSelectedClientId("");
      setMessage(t("reports.generated"));
      router.refresh();
    } catch (err) {
      setError(true); setMessage(err instanceof Error ? err.message : t("reports.generateFailed"));
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-5">
      {canWrite ? (
        <form onSubmit={generate} className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 md:p-6">
          <h2 className="text-lg font-semibold text-white">{t("reports.generate")}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">{t("reports.managerDescription")}</p>
          {clients.length ? (
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <label className="min-w-0 flex-1 space-y-2"><span className="block text-sm font-medium text-slate-200">{t("reports.client")}</span><select required value={selectedClientId} onChange={(event) => setSelectedClientId(event.target.value)} className="min-h-11 w-full rounded-xl border border-white/15 bg-slate-950/70 px-4 py-3 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"><option value="">{t("reports.chooseClient")}</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.organizationName ?? client.name ?? client.proposedBusiness ?? client.id}</option>)}</select></label>
              <button disabled={saving} type="submit" className="min-h-11 self-end rounded-xl border border-amber-300/30 bg-amber-300/10 px-5 py-3 text-sm font-semibold text-amber-100 hover:bg-amber-300/15 disabled:opacity-50">{saving ? t("reports.generating") : t("reports.generate")}</button>
            </div>
          ) : <p className="mt-4 text-sm text-slate-300">{t("reports.noClients")}</p>}
          <p aria-live="polite" role={error ? "alert" : "status"} className="mt-3 text-sm text-slate-200">{message}</p>
        </form>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(260px,.75fr)_minmax(0,1.5fr)]">
        <section className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.035] p-4 sm:p-5" aria-labelledby="saved-reports-heading">
          <h2 id="saved-reports-heading" className="text-lg font-semibold text-white">{t("reports.listTitle")}</h2>
          {reports.length === 0 ? <p className="mt-4 text-sm leading-6 text-slate-300">{t("reports.noReports")}</p> : (
            <ul className="mt-4 space-y-2">
              {reports.map((report) => (
                <li key={report.id}>
                  <button type="button" onClick={() => setSelectedReportId(report.id)} aria-pressed={selectedReportId === report.id} className={`min-h-11 w-full rounded-xl border p-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300 ${selectedReportId === report.id ? "border-cyan-300/40 bg-cyan-300/[0.08]" : "border-white/10 hover:bg-white/[0.04]"}`}>
                    <span className="block break-words text-sm font-semibold text-white">{report.title}</span>
                    <span className="mt-1 block text-xs leading-5 text-slate-400">{report.client?.organizationName ?? report.client?.name ?? t("reports.clientUnknown")}</span>
                    <span className="mt-1 block text-xs text-slate-500">{new Date(report.createdAt).toLocaleString()}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.035] p-4 sm:p-6" aria-labelledby="report-preview-heading">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0"><h2 id="report-preview-heading" className="text-lg font-semibold text-white">{t("reports.preview")}</h2><p className="mt-1 text-xs leading-5 text-slate-400">{t("reports.scope")}</p></div>
            {selectedReport ? <a href={`/api/reports/${encodeURIComponent(selectedReport.id)}?format=html`} className="inline-flex min-h-11 shrink-0 items-center rounded-lg border border-cyan-300/20 px-3 py-2 text-sm font-semibold text-cyan-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300">{t("reports.download")}</a> : null}
          </div>
          {!selectedReport ? <p className="mt-5 text-sm leading-6 text-slate-300">{t("reports.noReportTitle")}</p> : selectedReport.document ? (
            <article className="mt-5 min-w-0">
              <h3 className="break-words text-xl font-semibold text-white">{selectedReport.document.title}</h3>
              <p className="mt-2 text-xs text-slate-400">{t("reports.generatedAt", { date: new Date(selectedReport.document.generatedAt).toLocaleString() })}</p>
              <p className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/[0.04] p-3 text-sm leading-6 text-amber-100">{t("reports.freshness")}</p>
              <div className="mt-4 space-y-4">
                {selectedReport.document.sections.map((section) => <section key={section.id} className="border-t border-white/10 pt-4"><h4 className="text-base font-semibold text-white">{section.title}</h4><pre className="mt-2 whitespace-pre-wrap break-words font-sans text-sm leading-6 text-slate-300">{section.content}</pre></section>)}
              </div>
              <p className="mt-5 border-t border-white/10 pt-4 text-sm leading-6 text-slate-300">{selectedReport.document.disclaimer}</p>
              <p className="mt-3 text-xs leading-5 text-slate-400">{t("reports.viewScope")}</p>
            </article>
          ) : <p className="mt-5 text-sm leading-6 text-slate-300">{t("reports.noClientSummary")}</p>}
        </section>
      </div>
    </div>
  );
}
