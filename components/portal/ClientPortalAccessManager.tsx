"use client";

import { localizeApiError } from "@/lib/i18n/api-errors";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { ClientPortalInbox } from "@/components/portal/ClientPortalInbox";

type PortalResourceType = "TASK" | "FORMATION_TASK" | "OBLIGATION";
type PortalClient = {
  id: string;
  displayName: string;
  email: string | null;
  grants: Array<{
    id: string;
    canViewStatus: boolean;
    canViewTasks: boolean;
    canUploadEvidence: boolean;
    expiresAt: Date | null;
    revokedAt: Date | null;
    active: boolean;
    user: { email: string; name: string | null };
  }>;
  resources: Array<{
    id: string;
    type: PortalResourceType;
    title: string;
    status: string;
    visible: boolean;
  }>;
  interactions: Array<{
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
  }>;
};

export function ClientPortalAccessManager({ clients, canWrite }: { clients: PortalClient[]; canWrite: boolean }) {
  const { t } = useLocale();
  const router = useRouter();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function send(url: string, method: "POST" | "DELETE" | "PATCH", body?: object) {
    setBusyKey(url);
    setMessage("");
    try {
      const response = await fetch(url, {
        method,
        headers: body ? { "content-type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(localizeApiError(t, result.error, t("app.portal.updateFailed")));
      router.refresh();
      setMessage(t("app.portal.updated"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("app.portal.updateFailed"));
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="space-y-5">
      {clients.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/10 p-6 text-sm text-slate-400">{t("app.portal.adminNoClients")}</p>
      ) : clients.map((client) => (
        <section key={client.id} className="space-y-4 rounded-2xl border border-white/10 bg-slate-900/50 p-5">
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">{client.displayName}</h2>
              <p className="mt-1 text-sm text-slate-400">{client.email ?? t("app.portal.noClientEmail")}</p>
            </div>
            {client.email ? (
              <button
                type="button"
                className="rounded-lg bg-cyan-300 px-3 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
                disabled={busyKey !== null || !canWrite}
                onClick={() => send(
                  `/api/clients/${encodeURIComponent(client.id)}/portal-access`,
                  "POST",
                  { email: client.email },
                )}
              >
                {t("app.portal.grant")}
              </button>
            ) : null}
          </header>

          <div className="space-y-2">
            <h3 className="text-sm font-medium text-slate-200">{t("app.portal.clientAccess")}</h3>
            {client.grants.length === 0 ? (
              <p className="text-sm text-slate-500">{t("app.portal.noGrants")}</p>
            ) : client.grants.map((grant) => {
              return (
                <div key={grant.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 px-3 py-2">
                  <div>
                    <p className="text-sm text-white">{grant.user.name ?? grant.user.email}</p>
                    <p className="text-xs text-slate-500">{grant.user.email} · {grant.active ? t("app.portal.active") : t("app.portal.revokedExpired")}</p>
                  </div>
                  {grant.active ? (
                    <button
                      type="button"
                      className="rounded-md border border-rose-300/20 px-3 py-1.5 text-xs text-rose-200 disabled:opacity-50"
                      disabled={busyKey !== null || !canWrite}
                      onClick={() => send(
                        `/api/clients/${encodeURIComponent(client.id)}/portal-access/${encodeURIComponent(grant.id)}`,
                        "DELETE",
                      )}
                    >
                      {t("app.portal.revoke")}
                    </button>
                  ) : null}
                </div>
              );
            })}
            <p className="text-xs leading-5 text-slate-500">
              {t("app.portal.accessHelp")}
            </p>
          </div>

          {client.resources.length ? (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-slate-200">{t("app.portal.publishRequests")}</h3>
              <ul className="divide-y divide-white/10 rounded-lg border border-white/10">
                {client.resources.map((resource) => {
                  const url = `/api/clients/${encodeURIComponent(client.id)}/portal-visibility`;
                  return (
                    <li key={`${resource.type}:${resource.id}`} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2">
                      <div>
                        <p className="text-sm text-slate-200">{resource.title}</p>
                        <p className="text-xs text-slate-500">{resource.status.replaceAll("_", " ")}</p>
                      </div>
                      <button
                        type="button"
                        className={`rounded-md border px-3 py-1.5 text-xs disabled:opacity-50 ${resource.visible ? "border-cyan-300/20 text-cyan-100" : "border-white/10 text-slate-300"}`}
                        disabled={busyKey !== null || !canWrite}
                        onClick={() => send(url, "PATCH", {
                          resourceType: resource.type,
                          resourceId: resource.id,
                          visible: !resource.visible,
                        })}
                      >
                        {resource.visible ? t("app.portal.unpublish") : t("app.portal.publish")}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
          <ClientPortalInbox
            clientId={client.id}
            interactions={client.interactions}
            resources={client.resources}
            canWrite={canWrite}
          />
        </section>
      ))}
      {message ? <p role="status" className="text-sm text-slate-300">{message}</p> : null}
    </div>
  );
}
