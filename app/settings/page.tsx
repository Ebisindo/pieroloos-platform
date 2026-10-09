import { WorkspaceAccessState } from "@/components/auth/WorkspaceAccessState";
import { WorkspaceSettingsForm } from "@/components/settings/WorkspaceSettingsForm";
import { WorkspaceSelector } from "@/components/workspace/WorkspaceSelector";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { hasPermission } from "@/lib/auth/roles";
import { prisma } from "@/lib/db/prisma";
import { DEFAULT_WORKSPACE_SETTINGS, workspaceSettingsSchema } from "@/lib/validation/settings";

export default async function SettingsPage() {
  const context = await getWorkspaceContext();
  if (!context.userId) {
    return (
      <WorkspaceAccessState
        title="Sign in to manage Settings"
        description="Workspace preferences are available to authenticated members."
        href="/signin?callbackUrl=/settings"
        action="Sign in"
      />
    );
  }

  if (!context.workspaces.length) {
    return (
      <WorkspaceAccessState
        title="Workspace membership required"
        description="This account is not associated with a workspace. Ask an organization owner to provision your membership."
      />
    );
  }

  if (!context.activeWorkspace || !context.principal) {
    return (
      <div className="page-stack">
        <header>
          <p className="eyebrow">WORKSPACE CONFIGURATION</p>
          <h1>Settings</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">Choose the workspace whose preferences you want to manage.</p>
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
          <p className="eyebrow">WORKSPACE CONFIGURATION</p>
          <h1>Settings</h1>
          <p>Workspace defaults and operational notification controls.</p>
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