"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type PortalResource = { id: string; type: "TASK" | "FORMATION_TASK" | "OBLIGATION"; title: string };
type PortalInteraction = {
  id: string;
  kind: string;
  status: string | null;
  resourceType: string | null;
  resourceId: string | null;
  parentInteractionId: string | null;
  body: string;
  contentHash: string | null;
  reviewNote: string | null;
  createdAt: Date;
  actor: { id: string; name: string | null; email: string };
  parentInteraction: { body: string; kind: string } | null;
};

export function ClientPortalCollaboration({
  clientId,
  resources,
  interactions,
}: {
  clientId: string;
  resources: PortalResource[];
  interactions: PortalInteraction[];
}) {
  const router = useRouter();
  const [messageContent, setMessageContent] = useState("");
  const [completionContent, setCompletionContent] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [acknowledged, setAcknowledged] = useState<string[]>([]);

  async function submit(payload: object) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/portal/clients/${encodeURIComponent(clientId)}/interactions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to send portal response.");
      setMessageContent("");
      setCompletionContent({});
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to send portal response.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-5 rounded-xl border border-white/10 p-5">
      <div>
        <h3 className="font-medium text-white">Messages and client actions</h3>
        <p className="mt-1 text-xs leading-5 text-slate-400">
          Your updates are shared with your professional team. Submitting a request does not complete or change its workflow status.
        </p>
      </div>

      {interactions.length ? (
        <ol className="space-y-3">
          {interactions.map((item) => (
            <li key={item.id} className="rounded-lg border border-white/10 bg-slate-950/40 p-3">
              <div className="flex flex-wrap justify-between gap-2 text-xs text-slate-400">
                <span>{item.actor.name ?? item.actor.email} · {item.kind.replaceAll("_", " ").toLowerCase()}</span>
                <time dateTime={new Date(item.createdAt).toISOString()}>
                  {new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.createdAt))}
                </time>
              </div>
              {item.parentInteraction ? (
                <p className="mt-2 border-l-2 border-cyan-300/20 pl-3 text-sm text-slate-400">
                  Requested: {item.parentInteraction.body}
                </p>
              ) : null}
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-200">{item.body}</p>
              {item.status ? <p className="mt-2 text-xs uppercase tracking-wide text-cyan-100">{item.status.replaceAll("_", " ")}</p> : null}
              {item.reviewNote ? <p className="mt-2 text-sm text-amber-100">Professional note: {item.reviewNote}</p> : null}
              {item.kind === "ACKNOWLEDGMENT_REQUEST" && item.status === "PENDING" ? (
                <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
                  <label className="flex items-start gap-2 text-xs leading-5 text-slate-300">
                    <input
                      type="checkbox"
                      checked={acknowledged.includes(item.id)}
                      onChange={(event) => setAcknowledged((existing) =>
                        event.target.checked ? [...existing, item.id] : existing.filter((id) => id !== item.id),
                      )}
                    />
                    I confirm that I have read and acknowledge the exact statement above.
                  </label>
                  <button
                    type="button"
                    className="rounded-md bg-cyan-300 px-3 py-2 text-xs font-semibold text-slate-950 disabled:opacity-50"
                    disabled={busy || !acknowledged.includes(item.id)}
                    onClick={() => submit({ kind: "ACKNOWLEDGMENT", requestId: item.id })}
                  >
                    Record acknowledgment
                  </button>
                  <p className="text-xs text-slate-500">
                    This records an authenticated acknowledgment, not a legally binding electronic signature.
                  </p>
                </div>
              ) : null}
              {item.kind === "ACKNOWLEDGMENT" && item.contentHash ? (
                <p className="mt-2 break-all font-mono text-[10px] text-slate-500">SHA-256 · {item.contentHash}</p>
              ) : null}
            </li>
          ))}
        </ol>
      ) : <p className="text-sm text-slate-500">No messages or responses yet.</p>}

      {resources.map((resource) => {
        const key = `${resource.type}:${resource.id}`;
        const value = completionContent[key] ?? "";
        return (
          <div key={key} className="rounded-lg border border-white/10 p-3">
            <p className="text-sm font-medium text-slate-200">{resource.title}</p>
            <textarea
              className="mt-2 min-h-20 w-full rounded-md border border-white/10 bg-slate-950 p-2 text-sm text-white"
              aria-label={`Completion details for ${resource.title}`}
              placeholder="Describe what you have completed or provide an update"
              value={value}
              onChange={(event) => setCompletionContent((current) => ({ ...current, [key]: event.target.value }))}
              maxLength={4000}
            />
            <button
              type="button"
              className="mt-2 rounded-md border border-cyan-300/20 px-3 py-2 text-xs text-cyan-100 disabled:opacity-50"
              disabled={busy || !value.trim()}
              onClick={() => submit({
                kind: "COMPLETION_SUBMISSION",
                resourceType: resource.type,
                resourceId: resource.id,
                content: value,
              })}
            >
              Submit for professional review
            </button>
          </div>
        );
      })}

      <form
        className="space-y-2 border-t border-white/10 pt-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (messageContent.trim()) void submit({ kind: "MESSAGE", content: messageContent });
        }}
      >
        <label htmlFor={`portal-message-${clientId}`} className="block text-sm font-medium text-slate-200">Send a message</label>
        <textarea
          id={`portal-message-${clientId}`}
          className="min-h-20 w-full rounded-md border border-white/10 bg-slate-950 p-2 text-sm text-white"
          value={messageContent}
          onChange={(event) => setMessageContent(event.target.value)}
          maxLength={4000}
          required
        />
        <button type="submit" disabled={busy || !messageContent.trim()} className="rounded-md bg-cyan-300 px-3 py-2 text-xs font-semibold text-slate-950 disabled:opacity-50">
          Send message
        </button>
      </form>
      {error ? <p role="alert" className="text-sm text-rose-200">{error}</p> : null}
    </section>
  );
}
