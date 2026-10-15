import { notFound } from "next/navigation";
import { WorkspaceAccessState } from "@/components/auth/WorkspaceAccessState";
import { EngagementManager } from "@/components/engagements/EngagementManager";
import { ModuleBanner } from "@/components/ui/ModuleBanner";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { engagementRepository } from "@/lib/db/engagement-repository";
import { clientRepository } from "@/lib/db/client-repository";
import { getRequestTranslator } from "@/lib/i18n/request";

export default async function EngagementsPage() {
  const t = await getRequestTranslator();
  const context = await getWorkspaceContext();
  if (!context.userId) return <WorkspaceAccessState title={t("app.clients.signInTitle")} description={t("app.clients.signInDescription")} href="/signin?callbackUrl=/engagements" action={t("navigation.signIn")} />;
  if (!context.activeWorkspace || !context.principal) return <WorkspaceAccessState title={t("app.clients.workspaceRequired")} description={t("app.clients.workspaceDescription")} />;
  if (!context.principal.permissions.includes("engagement:read")) return <WorkspaceAccessState title={t("app.clients.accessRequired")} description={t("app.clients.accessDescription")} href="/command-center" action={t("navigation.businessFormation")} />;

  const [engagements, allClients] = await Promise.all([
    engagementRepository.listByWorkspace(context.principal),
    context.principal.permissions.includes("client:read") ? clientRepository.listByWorkspace(context.principal) : Promise.resolve([]),
  ]);
  const clients = allClients.map((client) => ({
    id: client.id,
    name: client.name,
    organizationName: client.organizationName,
    proposedBusiness: client.proposedBusiness,
  }));

  return (
    <main className="page-stack">
      <ModuleBanner eyebrow={t("engagements.eyebrow")} title={t("engagements.title")} description={t("engagements.managerDescription")} visual="flow" />
      <EngagementManager initialEngagements={engagements} clients={clients} canWrite={context.principal.permissions.includes("engagement:write")} />
    </main>
  );
}
