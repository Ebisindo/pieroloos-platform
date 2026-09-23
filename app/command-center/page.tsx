import Link from "next/link";
import { ArrowUpRight, Database, FileCheck2, ShieldCheck, Workflow } from "lucide-react";
import { GlassPanel, MetricCard, PageHeader, SectionHeader, StatusBadge } from "@/components/ui/primitives";
import { productModules } from "@/lib/navigation";

export default function CommandCenterPage() {
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="EXECUTIVE OPERATING VIEW"
        title="Command Center"
        description="A single operational surface for clients, engagements, evidence, workflows, and professional-service delivery."
        actions={<Link href="/clients/new" className="button button-primary">New client</Link>}
      />

      <div className="metric-grid">
        <MetricCard label="Active clients" value="0" detail="Awaiting first operational record" tone="gold" />
        <MetricCard label="Engagements" value="0" detail="No active engagements yet" tone="violet" />
        <MetricCard label="Reports" value="0" detail="Report engine initialized" tone="cyan" />
        <MetricCard label="Compliance" value="Ready" detail="Control layer initialized" tone="gold" />
      </div>

      <div className="dashboard-grid">
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
            <SectionHeader title="Recent activity" />
            <div className="empty-inline">No activity has been recorded yet. New client and engagement actions will appear here.</div>
          </GlassPanel>
        </div>
      </div>
    </div>
  );
}
