export function EscalationBanner({
  level,
  message,
}: {
  level: number;
  message: string;
}) {
  if (level <= 0) return null;

  return (
    <aside className="rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-4">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-amber-200/70">
        Escalation level {level}
      </p>
      <p className="mt-1 text-sm text-white/70">{message}</p>
    </aside>
  );
}
