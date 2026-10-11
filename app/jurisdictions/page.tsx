import { JurisdictionCard } from "@/components/jurisdiction/JurisdictionCard";
import { JurisdictionLensWorkflow } from "@/components/jurisdiction/JurisdictionLensWorkflow";
import { WorkspaceAccessState } from "@/components/auth/WorkspaceAccessState";
import { TrustBoundaryNotice } from "@/components/evidence/TrustBoundaryNotice";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { jurisdictionRepository } from "@/lib/db/jurisdiction-repository";
import { prisma } from "@/lib/db/prisma";
import { getRequestTranslator } from "@/lib/i18n/request";

export default async function JurisdictionsPage() {
  const t = await getRequestTranslator();
  const context = await getWorkspaceContext();
  if (!context.userId) {
    return (
      <WorkspaceAccessState
        title={t("signin.title")}
        description={t("app.jurisdiction.description")}
        href="/signin?callbackUrl=/jurisdictions"
        action={t("navigation.signIn")}
      />
    );
  }
  if (!context.activeWorkspace || !context.principal) {
    return <WorkspaceAccessState title={t("app.jurisdiction.selectWorkspace")} description={t("app.jurisdiction.description")} />;
  }
  if (!context.principal.permissions.includes("jurisdictions:read")) {
    return <WorkspaceAccessState title={t("app.jurisdiction.accessRequired")} description={t("app.jurisdiction.description")} />;
  }

  const workspaceId = context.principal.workspaceId;
  const jurisdictions = await jurisdictionRepository.list(workspaceId);
  const profiles = await prisma.businessProfile.findMany({
    where: { client: { workspaceId } },
    select: {
      id: true,
      businessName: true,
      client: { select: { name: true, organizationName: true, firstName: true, lastName: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  const profileOptions = profiles.map((profile) => ({
    id: profile.id,
    name: profile.businessName
      ?? profile.client.organizationName
      ?? profile.client.name
      ?? [profile.client.firstName, profile.client.lastName].filter(Boolean).join(" ")
      ?? t("module.businessProfile"),
  }));

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs uppercase tracking-[0.24em] text-cyan-300/70">{t("app.jurisdiction.eyebrow")}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">{t("app.jurisdiction.title")}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">{t("app.jurisdiction.description")}</p>
      </header>

      <TrustBoundaryNotice heading={t("app.jurisdiction.trustHeading")} />

      {!workspaceId ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900/40 p-8 text-sm text-slate-400">
          {t("app.jurisdiction.selectWorkspace")}
        </div>
      ) : jurisdictions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-slate-500">
          {t("app.jurisdiction.noRecords")}
        </div>
      ) : (
        <JurisdictionLensWorkflow
          jurisdictions={jurisdictions}
          profiles={profileOptions}
          canCompare={context.principal.permissions.includes("jurisdictions:write")}
          canCreateFormation={context.principal.permissions.includes("formation:write")}
        />
      )}
    </div>
  );
}
