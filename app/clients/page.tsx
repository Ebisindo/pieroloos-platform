import { WorkspaceAccessState } from "@/components/auth/WorkspaceAccessState";
import { ClientPortalAccessManager } from "@/components/portal/ClientPortalAccessManager";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import {
  listWorkspaceClientPortalInteractions,
  listWorkspacePortalClients,
} from "@/lib/services/client-portal-service";

export default async function ClientsPage() {
  const context = await getWorkspaceContext();
  if (!context.userId) {
    return <WorkspaceAccessState title="Sign in to manage clients" description="Client records and client portal access require an authenticated workspace member." href="/signin?callbackUrl=/clients" action="Sign in" />;
  }
  if (!context.activeWorkspace || !context.principal) {
    return <WorkspaceAccessState title="Workspace selection required" description="Select an active workspace to manage client portal access." />;
  }
  if (!context.principal.permissions.includes("client:read")) {
    return <WorkspaceAccessState title="Client access required" description="Your workspace role cannot manage client portal access." />;
  }

  const clients = await listWorkspacePortalClients(context.principal);
  const clientsWithInteractions = await Promise.all(clients.map(async (client) => ({
    ...client,
    interactions: await listWorkspaceClientPortalInteractions(client.id, context.principal!),
  })));
  return (
    <main className="page-stack">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-300/70">Client operations</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Client portal access</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
          Grant client-scoped status and evidence access, publish only the requests clients should see, and revoke access when collaboration ends.
        </p>
      </header>
      <div className="rounded-xl border border-amber-300/15 bg-amber-300/[0.04] p-4 text-sm leading-6 text-amber-100">
        Client-visible requests are opt-in and hidden by default. Clients can submit completion details, exchange visible messages, and acknowledge exact statements. Acknowledgments are not legal electronic signatures; workflow status remains under professional control.
      </div>
      <ClientPortalAccessManager
        clients={clientsWithInteractions}
        canWrite={context.principal.permissions.includes("client:write")}
      />
    </main>
  );
}
