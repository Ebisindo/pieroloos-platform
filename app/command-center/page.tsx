import Link from "next/link";
import { ArrowUpRight, Database, FileCheck2, ShieldCheck, Workflow } from "lucide-react";
import { ActionQueue } from "@/components/control-plane/ActionQueue";
import { NotificationInbox } from "@/components/control-plane/NotificationInbox";
import { NotificationPreferencesForm } from "@/components/control-plane/NotificationPreferencesForm";
import { GlassPanel, MetricCard, PageHeader, SectionHeader, StatusBadge } from "@/components/ui/primitives";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { listActiveOperationalActions } from "@/lib/db/operational-action-query";
import { notificationRepository } from "@/lib/db/notification-repository";
import { prisma } from "@/lib/db/prisma";
import { productModules } from "@/lib/navigation";

export default async function CommandCenterPage() {
  const context = await getWorkspaceContext();
  const canReadWorkspace = context.principal?.permissions.includes("workspace:read") ?? false;
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
        },
      }).then((preference) => preference ?? {
        inAppEnabled: true,
        emailEnabled: false,
        quietHoursStart: null,
        quietHoursEnd: null,
        timezone: "UTC",
      })
      : null,
  ]);

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="EXECUTIVE OPERATING VIEW"
        title="Business Formation"
        description="A single operational surface for clients, engagements, evidence, workflows, and professional-service delivery."
        actions={<Link href="/clients/new" className="button button-primary">New client</Link>}
      />

      <div className="metric-grid">
        <MetricCard label="Active clients" value={counts ? String(counts[0]) : "N/A"} detail={counts ? "With active engagements" : "Select an active workspace"} tone="gold" />
        <MetricCard label="Engagements" value={counts ? String(counts[1]) : "N/A"} detail={counts ? "Currently active" : "Select an active workspace"} tone="violet" />
        <MetricCard label="Reports" value={counts ? String(counts[2]) : "N/A"} detail={counts ? "In this workspace" : "Select an active workspace"} tone="cyan" />
        <MetricCard label="Compliance" value="Ready" detail="Control layer initialized" tone="gold" />
      </div>

      <div className="dashboard-grid">
        <div className="stack">
          <GlassPanel>
            <SectionHeader title="Operational actions" description="Open work prioritized by urgency, deadline, and escalation." />
            {activeActions ? (
              <ActionQueue actions={activeActions} canManage={canManageActions} assignees={assignees} />
            ) : (
              <div className="empty-inline">
                {context.principal ? "Compliance access is required to view actions." : "Select an active workspace to view actions."}
              </div>
            )}
          </GlassPanel>
          <GlassPanel>
            <SectionHeader title="Operational loop" description="The initial PieroloOS workflow is now represented as connected modules." />
            <div className="workflow-list">
              {productModules.map((module, index) => (
                <Link href={module.href} className="workflow-row" key={module.key}>
                  <div className="workflow-index">{String(index + 1).padStart(2, "0")}</div>
                  <div className="workflow-copy">
                    <strong>{module.label}</strong>
                    <span>{module.status === "operational" ? "Operational foundation" : "Domain foundation ready"}</span>
                  </div>
                  <ArrowUpRight size={17} />
                </Link>
              ))}
            </div>
          </GlassPanel>
        </div>

        <div className="stack">
          <GlassPanel>
            <SectionHeader title="System state" />
            <div className="state-list">
              <div><span><Database size={16} /> Data architecture</span><StatusBadge tone="success">Ready</StatusBadge></div>
              <div><span><ShieldCheck size={16} /> Authority model</span><StatusBadge tone="success">Defined</StatusBadge></div>
              <div><span><FileCheck2 size={16} /> Evidence layer</span><StatusBadge tone="success">Defined</StatusBadge></div>
              <div><span><Workflow size={16} /> Workflow engine</span><StatusBadge tone="info">Foundation</StatusBadge></div>
            </div>
          </GlassPanel>
          <GlassPanel>
            <SectionHeader title="Notifications" description="Operational updates addressed to you in this workspace." />
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
