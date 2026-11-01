import Link from "next/link";
import { ArrowUpRight, Database, FileCheck2, ShieldCheck, Workflow } from "lucide-react";
import { ActionQueue } from "@/components/control-plane/ActionQueue";
import { NotificationInbox } from "@/components/control-plane/NotificationInbox";
import { NotificationPreferencesForm } from "@/components/control-plane/NotificationPreferencesForm";
import { ModuleBanner } from "@/components/ui/ModuleBanner";
import { GlassPanel, MetricCard, SectionHeader, StatusBadge } from "@/components/ui/primitives";
import { WorkspaceAccessState } from "@/components/auth/WorkspaceAccessState";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { listActiveOperationalActions } from "@/lib/db/operational-action-query";
import { notificationRepository } from "@/lib/db/notification-repository";
import { prisma } from "@/lib/db/prisma";
import { productModules } from "@/lib/navigation";
import { getRequestTranslator } from "@/lib/i18n/request";
import type { MessageKey } from "@/lib/i18n/messages";

const moduleLabelKeys: Record<(typeof productModules)[number]["key"], MessageKey> = {
  clients: "module.clientIntake",
  "business-profile": "module.businessProfile",
  jurisdiction: "module.jurisdictionLens",
  expansion: "module.marketExpansion",
  "cross-border": "module.crossBorder",
  formation: "module.formationRoadmap",
  compliance: "module.compliance",
  reports: "module.reportGenerator",
  engagements: "module.engagementRecords",
};

export default async function CommandCenterPage() {
  const t = await getRequestTranslator();
  const context = await getWorkspaceContext();
  if (!context.userId) {
    return <WorkspaceAccessState title={t("app.clients.signInTitle")} description={t("app.clients.signInDescription")} href="/signin?callbackUrl=/command-center" action={t("navigation.signIn")} />;
  }
  if (!context.activeWorkspace || !context.principal) {
    return <WorkspaceAccessState title={t("app.clients.workspaceRequired")} description={t("app.clients.workspaceDescription")} />;
  }
  const canReadWorkspace = context.principal.permissions.includes("workspace:read");
  const canReadActions = context.principal?.permissions.includes("compliance:read") ?? false;
  const canManageActions = context.principal?.permissions.includes("compliance:write") ?? false;
  const [counts, activeActions, assignees, notifications, notificationPreferences] = await Promise.all([
    context.principal && canReadWorkspace
      ? Promise.all([
        prisma.client.count({
          where: { workspaceId: context.principal.workspaceId, engagements: { some: { status: "ACTIVE" } } },
        }),
        prisma.engagement.count({ where: { workspaceId: context.principal.workspaceId, status: "ACTIVE" } }),
        prisma.report.count({ where: { workspaceId: context.principal.workspaceId } }),
      ])
      : null,
    context.principal && canReadActions ? listActiveOperationalActions(context.principal) : null,
    context.principal && canManageActions
      ? prisma.membership.findMany({
        where: { organizationId: context.principal.organizationId },
        select: { userId: true, user: { select: { name: true, email: true } } },
        orderBy: { user: { email: "asc" } },
      }).then((members) => members.map(({ userId, user }) => ({ userId, ...user })))
      : [],
    context.principal && canReadActions ? notificationRepository.listForRecipient(context.principal) : [],
    context.principal && canReadActions
      ? prisma.notificationPreference.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: context.principal.workspaceId,
            userId: context.principal.userId,
          },
        },
        select: {
          inAppEnabled: true,
          emailEnabled: true,
          quietHoursStart: true,
          quietHoursEnd: true,
          timezone: true,
          locale: true,
        },
      }).then((preference) => preference ?? {
        inAppEnabled: true,
        emailEnabled: false,
        quietHoursStart: null,
        quietHoursEnd: null,
        timezone: "UTC",
        locale: "en",
      })
      : null,
  ]);

  return (
    <div className="page-stack">
      <ModuleBanner
        eyebrow={t("app.dashboard.eyebrow")}
        title={t("navigation.businessFormation")}
        description={t("app.dashboard.description")}
        visual="flow"
        action={<Link href="/clients/new" className="button button-primary">{t("app.dashboard.newClient")}</Link>}
      />

      <div className="metric-grid">
        <MetricCard label={t("app.dashboard.activeClients")} value={counts ? String(counts[0]) : t("app.dashboard.notAvailable")} detail={counts ? t("app.dashboard.withActiveEngagements") : t("app.dashboard.selectWorkspace")} tone="gold" />
        <MetricCard label={t("app.dashboard.engagements")} value={counts ? String(counts[1]) : t("app.dashboard.notAvailable")} detail={counts ? t("app.dashboard.currentlyActive") : t("app.dashboard.selectWorkspace")} tone="violet" />
        <MetricCard label={t("app.dashboard.reports")} value={counts ? String(counts[2]) : t("app.dashboard.notAvailable")} detail={counts ? t("app.dashboard.inWorkspace") : t("app.dashboard.selectWorkspace")} tone="cyan" />
        <MetricCard label={t("app.dashboard.compliance")} value={t("app.dashboard.ready")} detail={t("app.dashboard.controlLayerInitialized")} tone="gold" />
      </div>

      <div className="dashboard-grid">
        <div className="stack">
          <GlassPanel>
            <SectionHeader title={t("app.dashboard.operationalActions")} description={t("app.dashboard.actionsDescription")} />
            {activeActions ? (
              <ActionQueue actions={activeActions} canManage={canManageActions} assignees={assignees} />
            ) : (
              <div className="empty-inline">
                {context.principal ? t("app.dashboard.complianceAccessRequired") : t("app.dashboard.selectWorkspaceActions")}
              </div>
            )}
          </GlassPanel>
          <GlassPanel>
            <SectionHeader title={t("app.dashboard.operationalLoop")} description={t("app.dashboard.loopDescription")} />
            <div className="workflow-list">
              {productModules.map((module, index) => (
                <Link href={module.href} className="workflow-row" key={module.key}>
                  <div className="workflow-index">{String(index + 1).padStart(2, "0")}</div>
                  <div className="workflow-copy">
                    <strong>{t(moduleLabelKeys[module.key])}</strong>
                    <span>{module.status === "operational" ? t("app.dashboard.operationalFoundation") : t("app.dashboard.domainFoundationReady")}</span>
                  </div>
                  <ArrowUpRight size={17} />
                </Link>
              ))}
            </div>
          </GlassPanel>
        </div>

        <div className="stack">
          <GlassPanel>
            <SectionHeader title={t("app.dashboard.systemState")} />
            <div className="state-list">
              <div><span><Database size={16} /> {t("app.dashboard.dataArchitecture")}</span><StatusBadge tone="success">{t("app.dashboard.ready")}</StatusBadge></div>
              <div><span><ShieldCheck size={16} /> {t("app.dashboard.authorityModel")}</span><StatusBadge tone="success">{t("app.dashboard.defined")}</StatusBadge></div>
              <div><span><FileCheck2 size={16} /> {t("app.dashboard.evidenceLayer")}</span><StatusBadge tone="success">{t("app.dashboard.defined")}</StatusBadge></div>
              <div><span><Workflow size={16} /> {t("app.dashboard.workflowEngine")}</span><StatusBadge tone="info">{t("app.dashboard.foundation")}</StatusBadge></div>
            </div>
          </GlassPanel>
          <GlassPanel>
            <SectionHeader title={t("app.settings.notifications")} description={t("app.dashboard.notificationsDescription")} />
            <NotificationInbox notifications={notifications} />
            {notificationPreferences ? (
              <NotificationPreferencesForm initialPreferences={notificationPreferences} />
            ) : null}
          </GlassPanel>
        </div>
      </div>
    </div>
  );
}
