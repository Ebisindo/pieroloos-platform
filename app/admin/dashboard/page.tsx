import { PlatformPermission } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState, GlassPanel, MetricCard, PageHeader, StatusBadge } from "@/components/ui/primitives";
import { getCurrentPlatformActor, hasPlatformPermission } from "@/lib/auth/platform-access";
import { getPlatformDashboard } from "@/lib/services/platform-admin-service";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date);
}

export default async function AdminDashboardPage() {
  const actor = await getCurrentPlatformActor();
  if (!actor || !hasPlatformPermission(actor, PlatformPermission.DASHBOARD_READ)) notFound();

  const dashboard = await getPlatformDashboard(actor);
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow={actor.isSuperAdmin ? "SUPER ADMINISTRATOR" : "PLATFORM ADMINISTRATOR"}
        title="Administrative Control Centre"
        description="A permission-scoped view of operational records currently supported by PieroloOS."
        actions={<div className="page-header-actions">
          {actor.isSuperAdmin ? <Link className="button button-secondary" href="/admin/institutions">Global institution directory</Link> : null}
          {hasPlatformPermission(actor, PlatformPermission.ADMINS_READ)
            ? <Link className="button button-secondary" href="/admin/administrators">Manage administrators</Link>
            : null}
        </div>}
      />

      <section aria-label="Platform overview" className="metric-grid">
        <MetricCard
          label="Client records"
          value={dashboard.clientCount}
          detail={`All-time records; new in the last 30 days: ${dashboard.recentClientCount}`}
        />
        {dashboard.inquiryCount !== null ? (
          <MetricCard
            label="Open partnership inquiries"
            value={dashboard.inquiryCount}
            detail="Public inquiries awaiting manual review; these are not partner accounts."
            tone="violet"
          />
        ) : null}
        {dashboard.administratorCount !== null ? (
          <MetricCard
            label="Ordinary administrators"
            value={dashboard.administratorCount}
            detail={dashboard.superAdminCount === null ? "Platform administrator assignments" : `Plus ${dashboard.superAdminCount} Super Administrator`}
            tone="cyan"
          />
        ) : null}
      </section>

      {dashboard.recentClients ? (
        <section className="page-stack" aria-labelledby="recent-clients-title">
          <div className="section-header">
            <div>
              <h2 id="recent-clients-title">Recent client records</h2>
              <p>Registration time is the record creation date. The current client model has no verification or approval state.</p>
            </div>
          </div>
          {dashboard.recentClients.length ? (
            <GlassPanel className="admin-table-wrap">
              <table className="admin-table">
                <caption className="sr-only">Most recently created client records</caption>
                <thead>
                  <tr><th scope="col">Client</th><th scope="col">Record ID</th><th scope="col">Created (UTC)</th></tr>
                </thead>
                <tbody>
                  {dashboard.recentClients.map((client) => (
                    <tr key={client.id}>
                      <td>{client.name || client.organizationName || "Unnamed client"}</td>
                      <td><code>{client.id}</code></td>
                      <td><time dateTime={client.createdAt.toISOString()}>{formatDate(client.createdAt)}</time></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </GlassPanel>
          ) : (
            <EmptyState title="No client records yet" description="Client records will appear here after they are created through the existing intake workflow." />
          )}
        </section>
      ) : null}

      {dashboard.recentInquiries ? (
        <section className="page-stack" aria-labelledby="inquiries-title">
          <div className="section-header">
            <div>
              <h2 id="inquiries-title">Partnership inquiry queue</h2>
              <p>Review requests submitted through the public inquiry form; this is not partner onboarding.</p>
            </div>
          </div>
          {dashboard.recentInquiries.length ? (
            <GlassPanel className="admin-table-wrap">
              <table className="admin-table">
                <caption className="sr-only">Recent partnership inquiries requiring manual review</caption>
                <thead>
                  <tr><th scope="col">Organisation</th><th scope="col">Inquiry type</th><th scope="col">Status</th><th scope="col">Received (UTC)</th></tr>
                </thead>
                <tbody>
                  {dashboard.recentInquiries.map((inquiry) => (
                    <tr key={inquiry.id}>
                      <td>{inquiry.organisationName}</td>
                      <td>{inquiry.partnerType.replaceAll("_", " ").toLowerCase()}</td>
                      <td><StatusBadge tone={inquiry.status === "NEW" ? "warning" : "info"}>{inquiry.status.replaceAll("_", " ")}</StatusBadge></td>
                      <td><time dateTime={inquiry.createdAt.toISOString()}>{formatDate(inquiry.createdAt)}</time></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="admin-note">Inquiry records are read-only here. No approval or rejection workflow is implemented for partner applications.</p>
            </GlassPanel>
          ) : (
            <EmptyState title="No open partnership inquiries" description="New public inquiries are listed here when submitted." />
          )}
        </section>
      ) : null}

      {dashboard.recentAuditEvents ? (
        <section className="page-stack" aria-labelledby="audit-activity-title">
          <div className="section-header">
            <div>
              <h2 id="audit-activity-title">Recent administrative activity</h2>
              <p>Latest role provisioning, permission changes, and revocations.</p>
            </div>
          </div>
          {dashboard.recentAuditEvents.length ? (
            <GlassPanel>
              <ul className="admin-audit-list">
                {dashboard.recentAuditEvents.map((event) => (
                  <li key={event.id}>
                    <div><strong>{event.action.replaceAll("_", " ").toLowerCase()}</strong><span>{event.actor?.name || event.actorRole}{event.subjectType ? ` · ${event.subjectType}` : ""}</span></div>
                    <time dateTime={event.occurredAt.toISOString()}>{formatDate(event.occurredAt)}</time>
                  </li>
                ))}
              </ul>
            </GlassPanel>
          ) : (
            <EmptyState title="No administrative activity recorded" description="Privileged changes will be listed here after the first audited operation." />
          )}
        </section>
      ) : null}
    </div>
  );
}
