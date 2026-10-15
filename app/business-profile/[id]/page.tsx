import Link from "next/link";
import { notFound } from "next/navigation";
import { WorkspaceAccessState } from "@/components/auth/WorkspaceAccessState";
import { BusinessProfileEditor } from "@/components/business-profile/BusinessProfileEditor";
import { ModuleBanner } from "@/components/ui/ModuleBanner";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { businessProfileRepository } from "@/lib/db/business-profile-repository";
import { getRequestTranslator } from "@/lib/i18n/request";

type PageContext = { params: Promise<{ id: string }> };

export default async function BusinessProfileDetailPage({ params }: PageContext) {
  const t = await getRequestTranslator();
  const context = await getWorkspaceContext();
  if (!context.userId) return <WorkspaceAccessState title={t("app.clients.signInTitle")} description={t("app.clients.signInDescription")} href="/signin?callbackUrl=/business-profile" action={t("navigation.signIn")} />;
  if (!context.activeWorkspace || !context.principal) return <WorkspaceAccessState title={t("app.clients.workspaceRequired")} description={t("app.clients.workspaceDescription")} />;
  if (!context.principal.permissions.includes("client:read")) return <WorkspaceAccessState title={t("app.clients.accessRequired")} description={t("app.clients.accessDescription")} href="/command-center" action={t("navigation.businessFormation")} />;

  const { id } = await params;
  const profile = await businessProfileRepository.findById(id, context.principal);
  if (!profile) notFound();

  const editorProfile = { ...profile, data: profile.data && typeof profile.data === "object" && !Array.isArray(profile.data) ? profile.data as Record<string, unknown> : null };

  return (
    <main className="page-stack">
      <ModuleBanner eyebrow={t("profile.eyebrow")} title={profile.businessName ?? profile.client.organizationName ?? profile.client.name ?? t("profile.unnamedBusiness")} description={t("profile.detailDescription")} visual="evidence" action={<Link href="/business-profile" className="button button-secondary">{t("profile.backToProfiles")}</Link>} />
      <BusinessProfileEditor profile={editorProfile} canWrite={context.principal.permissions.includes("client:write")} />
    </main>
  );
}
