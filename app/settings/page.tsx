import { WorkspaceAccessState } from "@/components/auth/WorkspaceAccessState";
import { WorkspaceSettingsForm } from "@/components/settings/WorkspaceSettingsForm";
import { WorkspaceSelector } from "@/components/workspace/WorkspaceSelector";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { hasPermission } from "@/lib/auth/roles";
import { prisma } from "@/lib/db/prisma";
import { DEFAULT_WORKSPACE_SETTINGS, workspaceSettingsSchema } from "@/lib/validation/settings";
import { getRequestTranslator } from "@/lib/i18n/request";

export default async function SettingsPage() {
  const t = await getRequestTranslator();
  const context = await getWorkspaceContext();
  if (!context.userId) {
    return (
      <WorkspaceAccessState
        title={t("app.settings.signInTitle")}
        description={t("app.settings.signInDescription")}
        href="/signin?callbackUrl=/settings"
        action={t("navigation.signIn")}
      />
    );
  }

  if (!context.workspaces.length) {
    return (
      <WorkspaceAccessState
        title={t("app.settings.membershipRequired")}
        description={t("app.settings.membershipDescription")}
      />
    );
  }

  if (!context.activeWorkspace || !context.principal) {
    return (
      <div className="page-stack">
        <header>
          <p className="eyebrow">{t("app.settings.eyebrow")}</p>
          <h1>{t("navigation.settings")}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">{t("app.settings.chooseWorkspace")}</p>
        </header>
        <WorkspaceSelector workspaces={context.workspaces} />
      </div>
    );
  }

  const settings = await prisma.workspaceSettings.findUnique({
    where: { workspaceId: context.activeWorkspace.id },
  });
  const parsedSettings = settings ? workspaceSettingsSchema.safeParse({
    timezone: settings.timezone,
    defaultLandingPage: settings.defaultLandingPage,
    complianceReminderDays: settings.complianceReminderDays,
    notificationsEnabled: settings.notificationsEnabled,
    complianceDueNotifications: settings.complianceDueNotifications,
    evidenceReviewNotifications: settings.evidenceReviewNotifications,
    documentRetentionDays: settings.documentRetentionDays,
  }) : null;
  const initialSettings = parsedSettings?.success ? parsedSettings.data : DEFAULT_WORKSPACE_SETTINGS;

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">{t("app.settings.eyebrow")}</p>
          <h1>{t("navigation.settings")}</h1>
          <p>{t("app.settings.pageDescription")}</p>
        </div>
        <span className="status-badge status-info">{context.activeWorkspace.name}</span>
      </header>
      <WorkspaceSettingsForm
        initialSettings={initialSettings}
        canManage={hasPermission(context.activeWorkspace.role, "settings:manage")}
      />
    </div>
  );
}