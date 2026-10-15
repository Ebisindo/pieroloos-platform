import { notFound } from "next/navigation";
import { WorkspaceAccessState } from "@/components/auth/WorkspaceAccessState";
import { EngagementDetailEditor } from "@/components/engagements/EngagementDetailEditor";
import { ModuleBanner } from "@/components/ui/ModuleBanner";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { engagementRepository } from "@/lib/db/engagement-repository";
import { getRequestTranslator } from "@/lib/i18n/request";

type PageContext = { params: Promise<{ id: string }> };

export default async function EngagementDetailPage({ params }: PageContext) {
  const t = await getRequestTranslator();
  const context = await getWorkspaceContext();
  if (!context.userId) return <WorkspaceAccessState title={t("app.clients.signInTitle")} description={t("app.clients.signInDescription")} href="/signin?callbackUrl=/engagements" action={t("navigation.signIn")} />;
  if (!context.activeWorkspace || !context.principal) return <WorkspaceAccessState title={t("app.clients.workspaceRequired")} description={t("app.clients.workspaceDescription")} />;
  if (!context.principal.permissions.includes("engagement:read")) return <WorkspaceAccessState title={t("app.clients.accessRequired")} description={t("app.clients.accessDescription")} href="/command-center" action={t("navigation.businessFormation")} />;
  const { id } = await params;
  const engagement = await engagementRepository.findById(id, context.principal);
  if (!engagement) notFound();
  const initialEngagement = {
    ...engagement,
    createdAt: engagement.createdAt.toISOString(),
    updatedAt: engagement.updatedAt.toISOString(),
    activities: engagement.activities.map((activity) => ({
      ...activity,
      createdAt: activity.createdAt.toISOString(),
    })),
  };
  return (
    <main className="page-stack">
      <ModuleBanner eyebrow={t("engagements.eyebrow")} title={t("engagements.detail")} description={t("engagements.managerDescription")} visual="flow" />
      <EngagementDetailEditor initialEngagement={initialEngagement} canWrite={context.principal.permissions.includes("engagement:write")} />
    </main>
  );
}
