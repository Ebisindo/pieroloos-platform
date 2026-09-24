export type AuditTimelineItem = {
  id: string; action: string; actor: string; occurredAt: string; metadata?: Record<string, unknown>;
};

export function AuditTimeline({ items }: { items: AuditTimelineItem[] }) {
  return <ol className="space-y-4">{items.map(item => <li key={item.id} className="relative border-l border-white/10 pl-5">
    <span className="absolute -left-1.5 top-1.5 h-2.5 w-2.5 rounded-full border border-white/30 bg-slate-950" />
    <p className="text-sm font-medium text-white">{item.action}</p>
    <p className="mt-1 text-xs text-white/40">{item.actor} · {new Date(item.occurredAt).toLocaleString()}</p>
  </li>)}</ol>;
}
