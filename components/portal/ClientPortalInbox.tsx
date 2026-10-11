"use client";

import { localizeApiError } from "@/lib/i18n/api-errors";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { MessageKey } from "@/lib/i18n/messages";
import { formatDate } from "@/lib/i18n/messages";

type Resource = { id: string; type: "TASK" | "FORMATION_TASK" | "OBLIGATION"; title: string; visible: boolean };
type Interaction = {
  id: string;
  kind: string;
  status: string | null;
  resourceType: string | null;
  resourceId: string | null;
  parentInteractionId: string | null;
  body: string;
  contentHash: string | null;
  reviewNote: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  actor: { id: string; name: string | null; email: string };
  parentInteraction: { body: string; kind: string } | null;
};

export function ClientPortalInbox({
  clientId,
  interactions,
  resources,
  canWrite,
}: {
  clientId: string;
  interactions: Interaction[];
  resources: Resource[];
  canWrite: boolean;
}) {
  const { locale, t } = useLocale();
  const router = useRouter();
  const [content, setContent] = useState("");
  const [resourceKey, setResourceKey] = useState("");
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const selectedResource = resources.find((resource) => `${resource.type}:${resource.id}` === resourceKey);

  async function send(url: string, method: "POST" | "PATCH", body: object) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(localizeApiError(t, result.error, t("app.portal.updateFailed")));
      setContent("");
      setReviewNotes({});
      router.refresh();
      setMessage(t("app.portal.updated"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("app.portal.updateFailed"));
    } finally {
      setBusy(false);
    }
  }

  const kindKeys: Record<string, MessageKey> = {
    MESSAGE: "app.portal.kindMessage",
    COMPLETION_SUBMISSION: "app.portal.kindCompletion",
    ACKNOWLEDGMENT_REQUEST: "app.portal.kindAcknowledgmentRequest",
    ACKNOWLEDGMENT: "app.portal.kindAcknowledgment",
  };

  return (
    <details className="rounded-lg border border-white/10 p-3">
      <summary className="cursor-pointer text-sm font-medium text-slate-200">
        {t("app.portal.inboxTitle", { count: interactions.length })}
      </summary>
      <div className="mt-3 space-y-3">
        {interactions.length ? interactions.map((item) => (
          <article key={item.id} className="rounded-md border border-white/10 bg-slate-950/40 p-3">
            <div className="flex flex-wrap justify-between gap-2 text-xs text-slate-400">
              <span>{item.actor.name ?? item.actor.email} · {kindKeys[item.kind] ? t(kindKeys[item.kind]) : item.kind.replaceAll("_", " ").toLowerCase()}</span>
              <time dateTime={new Date(item.createdAt).toISOString()}>
                {formatDate(new Date(item.createdAt), locale, { dateStyle: "medium", timeStyle: "short" })}
              </time>
            </div>
            {item.parentInteraction ? <p className="mt-2 text-xs text-slate-400">{t("app.portal.request")} {item.parentInteraction.body}</p> : null}
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-200">{item.body}</p>
            {item.status ? <p className="mt-2 text-xs uppercase text-cyan-100">{item.status === "PENDING" ? t("app.status.pending") : item.status === "ACCEPTED" ? t("app.status.accepted") : item.status === "CHANGES_REQUESTED" ? t("app.compliance.changesRequested") : item.status.replaceAll("_", " ")}</p> : null}
            {item.reviewNote ? <p className="mt-2 text-sm text-amber-100">{t("app.portal.reviewNote")}: {item.reviewNote}</p> : null}
            {item.kind === "ACKNOWLEDGMENT" && item.contentHash ? (
              <p className="mt-2 break-all font-mono text-[10px] text-slate-500">SHA-256 · {item.contentHash}</p>
            ) : null}
            {canWrite && item.kind === "COMPLETION_SUBMISSION" && item.status === "PENDING" ? (
              <div className="mt-3 space-y-2">
                <p className="text-xs text-slate-500">{t("app.portal.completionOutcome")}</p>
                <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  className="rounded-md border border-emerald-300/20 px-3 py-1.5 text-xs text-emerald-100 disabled:opacity-50"
                  onClick={() => send(
                    `/api/clients/${encodeURIComponent(clientId)}/portal-interactions/${encodeURIComponent(item.id)}`,
                    "PATCH",
                    { decision: "ACCEPTED", note: reviewNotes[item.id] ?? "" },
                  )}
                >
                  {t("app.portal.acceptResponse")}
                </button>
                <button
                  type="button"
                  disabled={busy || !(reviewNotes[item.id] ?? "").trim()}
                  className="rounded-md border border-amber-300/20 px-3 py-1.5 text-xs text-amber-100 disabled:opacity-50"
                  onClick={() => send(
                    `/api/clients/${encodeURIComponent(clientId)}/portal-interactions/${encodeURIComponent(item.id)}`,
                    "PATCH",
                    { decision: "CHANGES_REQUESTED", note: reviewNotes[item.id] },
                  )}
                >
                  {t("app.portal.requestChanges")}
                </button>
                <input
                  className="min-w-48 flex-1 rounded-md border border-white/10 bg-slate-950 px-2 py-1.5 text-xs text-white"
                  aria-label={t("app.portal.reviewNote")}
                  placeholder={t("app.portal.requestChangesPlaceholder")}
                  maxLength={2000}
                  value={reviewNotes[item.id] ?? ""}
                  onChange={(event) => setReviewNotes((existing) => ({ ...existing, [item.id]: event.target.value }))}
                />
                </div>
              </div>
            ) : null}
          </article>
        )) : <p className="text-sm text-slate-500">{t("app.portal.noClientMessages")}</p>}

        {canWrite ? (
          <div className="space-y-2 border-t border-white/10 pt-3">
            <label className="block text-xs text-slate-300" htmlFor={`portal-resource-${clientId}`}>{t("app.portal.optionalRequest")}</label>
            <select
              id={`portal-resource-${clientId}`}
              className="w-full rounded-md border border-white/10 bg-slate-950 p-2 text-sm text-white"
              value={resourceKey}
              onChange={(event) => setResourceKey(event.target.value)}
            >
              <option value="">{t("app.portal.generalConversation")}</option>
              {resources.filter((resource) => resource.visible).map((resource) => (
                <option key={`${resource.type}:${resource.id}`} value={`${resource.type}:${resource.id}`}>{resource.title}</option>
              ))}
            </select>
            <textarea
              className="min-h-20 w-full rounded-md border border-white/10 bg-slate-950 p-2 text-sm text-white"
              aria-label={t("app.portal.messageText")}
              placeholder={resourceKey ? t("app.portal.acknowledgmentPlaceholder") : t("app.portal.clientMessagePlaceholder")}
              maxLength={4000}
              value={content}
              onChange={(event) => setContent(event.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy || !content.trim()}
                className="rounded-md bg-cyan-300 px-3 py-2 text-xs font-semibold text-slate-950 disabled:opacity-50"
                onClick={() => send(
                  `/api/clients/${encodeURIComponent(clientId)}/portal-interactions`,
                  "POST",
                  {
                    kind: "MESSAGE",
                    content,
                    ...(selectedResource ? { resourceType: selectedResource.type, resourceId: selectedResource.id } : {}),
                  },
                )}
              >
                {t("app.portal.sendClientMessage")}
              </button>
              {selectedResource ? (
                <button
                  type="button"
                  disabled={busy || !content.trim()}
                  className="rounded-md border border-amber-300/20 px-3 py-2 text-xs text-amber-100 disabled:opacity-50"
                  onClick={() => send(
                    `/api/clients/${encodeURIComponent(clientId)}/portal-interactions`,
                    "POST",
                    {
                      kind: "ACKNOWLEDGMENT_REQUEST",
                      resourceType: selectedResource.type,
                      resourceId: selectedResource.id,
                      content,
                    },
                  )}
                >
                  Request authenticated acknowledgment
                </button>
              ) : null}
            </div>
            {selectedResource ? <p className="text-xs text-slate-500">{t("app.portal.acknowledgmentDisclaimer")}</p> : null}
          </div>
        ) : null}
        {message ? <p role="status" className="text-sm text-slate-300">{message}</p> : null}
      </div>
    </details>
  );
}
