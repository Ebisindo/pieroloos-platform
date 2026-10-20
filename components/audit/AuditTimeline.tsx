"use client";

import { useLocale } from "@/components/i18n/LocaleProvider";
import { formatDate } from "@/lib/i18n/messages";

export type AuditTimelineItem = {
  id: string; action: string; actor: string; occurredAt: string; metadata?: Record<string, unknown>;
};

export function AuditTimeline({ items }: { items: AuditTimelineItem[] }) {
  const { locale } = useLocale();
  return <ol className="space-y-4">{items.map(item => <li key={item.id} className="relative border-l border-white/10 pl-5">
    <span className="absolute -left-1.5 top-1.5 h-2.5 w-2.5 rounded-full border border-white/30 bg-slate-950" />
    <p className="text-sm font-medium text-white">{item.action}</p>
    <p className="mt-1 text-xs text-white/40">{item.actor} · {formatDate(new Date(item.occurredAt), locale, { dateStyle: "medium", timeStyle: "short" })}</p>
  </li>)}</ol>;
}
