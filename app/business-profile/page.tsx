import Link from "next/link";
import { Building2 } from "lucide-react";
import { WorkspaceAccessState } from "@/components/auth/WorkspaceAccessState";
import { ModuleBanner } from "@/components/ui/ModuleBanner";
import { EmptyState, GlassPanel, StatusBadge } from "@/components/ui/primitives";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { businessProfileRepository } from "@/lib/db/business-profile-repository";
import { getRequestLocale, getRequestTranslator } from "@/lib/i18n/request";

export default async function BusinessProfilePage() {
  const [t, locale] = await Promise.all([getRequestTranslator(), getRequestLocale()]);
  const context = await getWorkspaceContext();
  if (!context.userId) return <WorkspaceAccessState title={t("app.clients.signInTitle")} description={t("app.clients.signInDescription")} href="/signin?callbackUrl=/business-profile" action={t("navigation.signIn")} />;
  if (!context.activeWorkspace || !context.principal) return <WorkspaceAccessState title={t("app.clients.workspaceRequired")} description={t("app.clients.workspaceDescription")} />;
  if (!context.principal.permissions.includes("client:read")) return <WorkspaceAccessState title={t("app.clients.accessRequired")} description={t("app.clients.accessDescription")} href="/command-center" action={t("navigation.businessFormation")} />;

  const clients = await businessProfileRepository.listByWorkspace(context.principal);
  return (
    <main className="page-stack">
      <ModuleBanner eyebrow={t("profile.eyebrow")} title={t("profile.title")} description={t("profile.description")} visual="evidence" action={<Link href="/clients/new" className="button button-primary">{t("profile.newIntake")}</Link>} />
      {clients.length === 0 ? (
        <EmptyState title={t("profile.emptyTitle")} description={t("profile.emptyDescription")} action={<Link href="/clients/new" className="button button-primary">{t("profile.startIntake")}</Link>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {clients.flatMap((client) => client.businessProfile ? [(
            <Link key={client.businessProfile.id} href={`/business-profile/${encodeURIComponent(client.businessProfile.id)}`} className="group block min-w-0 rounded-2xl border border-white/10 bg-white/[0.035] p-5 transition hover:border-cyan-300/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300">
              <div className="flex items-start justify-between gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-amber-300/20 bg-amber-300/[0.05] text-amber-200"><Building2 size={20} aria-hidden="true" /></span>
                <StatusBadge tone="info">{t("profile.version", { version: client.businessProfile.version })}</StatusBadge>
              </div>
              <h2 className="mt-4 break-words text-lg font-semibold text-white group-hover:text-cyan-100">{client.businessProfile.businessName ?? client.proposedBusiness ?? client.organizationName ?? client.name ?? t("profile.unnamedBusiness")}</h2>
              <p className="mt-2 break-words text-sm leading-6 text-slate-300">{client.businessProfile.businessType ?? t("profile.typeNotRecorded")}</p>
              <p className="mt-3 text-xs text-slate-400">{client.country ?? t("profile.countryNotRecorded")} · {t("profile.updatedAt", { date: new Date(client.businessProfile.updatedAt).toLocaleDateString(locale) })}</p>
              <p className="mt-4 text-sm font-semibold text-cyan-200">{t("profile.open")} →</p>
            </Link>
          )] : [])}
        </div>
      )}
      <GlassPanel className="p-4 text-sm leading-6 text-slate-300">{t("profile.privacyNote")}</GlassPanel>
    </main>
  );
}
