"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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
      if (!response.ok) throw new Error(result.error ?? "Unable to update client portal.");
      setContent("");
      setReviewNotes({});
      router.refresh();
      setMessage("Client portal updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update client portal.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="rounded-lg border border-white/10 p-3">
      <summary className="cursor-pointer text-sm font-medium text-slate-200">
        Client conversation and submissions ({interactions.length})
      </summary>
      <div className="mt-3 space-y-3">
        {interactions.length ? interactions.map((item) => (
          <article key={item.id} className="rounded-md border border-white/10 bg-slate-950/40 p-3">
            <div className="flex flex-wrap justify-between gap-2 text-xs text-slate-400">
              <span>{item.actor.name ?? item.actor.email} · {item.kind.replaceAll("_", " ").toLowerCase()}</span>
              <time dateTime={new Date(item.createdAt).toISOString()}>
                {new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.createdAt))}
              </time>
            </div>
            {item.parentInteraction ? <p className="mt-2 text-xs text-slate-400">Request: {item.parentInteraction.body}</p> : null}
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-200">{item.body}</p>
            {item.status ? <p className="mt-2 text-xs uppercase text-cyan-100">{item.status.replaceAll("_", " ")}</p> : null}
            {item.reviewNote ? <p className="mt-2 text-sm text-amber-100">Review note: {item.reviewNote}</p> : null}
            {item.kind === "ACKNOWLEDGMENT" && item.contentHash ? (
              <p className="mt-2 break-all font-mono text-[10px] text-slate-500">SHA-256 · {item.contentHash}</p>
            ) : null}
            {canWrite && item.kind === "COMPLETION_SUBMISSION" && item.status === "PENDING" ? (
              <div className="mt-3 space-y-2">
                <p className="text-xs text-slate-500">This records the professional review outcome only. It does not transition the underlying task or obligation.</p>
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
                  Accept client response
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
                  Request changes
                </button>
                <input
                  className="min-w-48 flex-1 rounded-md border border-white/10 bg-slate-950 px-2 py-1.5 text-xs text-white"
                  aria-label="Professional review note"
                  placeholder="Required when requesting changes"
                  maxLength={2000}
                  value={reviewNotes[item.id] ?? ""}
                  onChange={(event) => setReviewNotes((existing) => ({ ...existing, [item.id]: event.target.value }))}
                />
                </div>
              </div>
            ) : null}
          </article>
        )) : <p className="text-sm text-slate-500">No client messages or submissions.</p>}

        {canWrite ? (
          <div className="space-y-2 border-t border-white/10 pt-3">
            <label className="block text-xs text-slate-300" htmlFor={`portal-resource-${clientId}`}>Optional published request</label>
            <select
              id={`portal-resource-${clientId}`}
              className="w-full rounded-md border border-white/10 bg-slate-950 p-2 text-sm text-white"
              value={resourceKey}
              onChange={(event) => setResourceKey(event.target.value)}
            >
              <option value="">General client conversation</option>
              {resources.filter((resource) => resource.visible).map((resource) => (
                <option key={`${resource.type}:${resource.id}`} value={`${resource.type}:${resource.id}`}>{resource.title}</option>
              ))}
            </select>
            <textarea
              className="min-h-20 w-full rounded-md border border-white/10 bg-slate-950 p-2 text-sm text-white"
              aria-label="Message or acknowledgment text"
              placeholder={resourceKey ? "Write a message or exact acknowledgment request" : "Write a client-visible message"}
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
                Send client-visible message
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
            {selectedResource ? <p className="text-xs text-slate-500">Acknowledgment records are not legal electronic signatures.</p> : null}
          </div>
        ) : null}
        {message ? <p role="status" className="text-sm text-slate-300">{message}</p> : null}
      </div>
    </details>
  );
}
