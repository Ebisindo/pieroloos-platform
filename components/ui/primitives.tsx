import * as React from "react";

type ClassValue = string | false | null | undefined;

export function cx(...values: ClassValue[]) {
  return values.filter(Boolean).join(" ");
}

export function GlassPanel({
  children,
  className,
  as: Comp = "section",
}: {
  children: React.ReactNode;
  className?: string;
  as?: keyof React.JSX.IntrinsicElements;
}) {
  return <Comp className={cx("glass-panel", className)}>{children}</Comp>;
}

export function StatusBadge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
}) {
  return <span className={`status-badge status-${tone}`}>{children}</span>;
}

export function MetricCard({
  label,
  value,
  detail,
  tone = "gold",
}: {
  label: string;
  value: string | number;
  detail?: string;
  tone?: "gold" | "violet" | "cyan";
}) {
  return (
    <GlassPanel className={`metric-card metric-${tone}`}>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      {detail ? <div className="metric-detail">{detail}</div> : null}
    </GlassPanel>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  );
}

export function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="section-header">
      <div>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <GlassPanel className="empty-state">
      <div className="empty-orbit" aria-hidden="true" />
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </GlassPanel>
  );
}
