import { WorkspaceAccessState } from "@/components/auth/WorkspaceAccessState";
import { ClientPortalAccessManager } from "@/components/portal/ClientPortalAccessManager";
import { ModuleBanner } from "@/components/ui/ModuleBanner";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import {
  listWorkspaceClientPortalInteractions,
  listWorkspacePortalClients,
} from "@/lib/services/client-portal-service";
import { getRequestTranslator } from "@/lib/i18n/request";

export default async function ClientsPage() {
  const t = await getRequestTranslator();
  const context = await getWorkspaceContext();
  if (!context.userId) {
    return <WorkspaceAccessState title={t("app.clients.signInTitle")} description={t("app.clients.signInDescription")} href="/signin?callbackUrl=/clients" action={t("navigation.signIn")} />;
  }
  if (!context.activeWorkspace || !context.principal) {
    return <WorkspaceAccessState title={t("app.clients.workspaceRequired")} description={t("app.clients.workspaceDescription")} />;
  }
  if (!context.principal.permissions.includes("client:read")) {
    return <WorkspaceAccessState title={t("app.clients.accessRequired")} description={t("app.clients.accessDescription")} />;
  }

  const clients = await listWorkspacePortalClients(context.principal);
  const clientsWithInteractions = await Promise.all(clients.map(async (client) => ({
    ...client,
    interactions: await listWorkspaceClientPortalInteractions(client.id, context.principal!),
  })));
  return (
    <main className="page-stack">
      <ModuleBanner
        eyebrow={t("app.clients.eyebrow")}
        title={t("app.clients.portalTitle")}
        description={t("app.clients.portalDescription")}
        visual="evidence"
      />
      <div className="rounded-xl border border-amber-300/15 bg-amber-300/[0.04] p-4 text-sm leading-6 text-amber-100">
        {t("app.clients.portalBoundary")}
      </div>
      <ClientPortalAccessManager
        clients={clientsWithInteractions}
        canWrite={context.principal.permissions.includes("client:write")}
      />
    </main>
  );
}
