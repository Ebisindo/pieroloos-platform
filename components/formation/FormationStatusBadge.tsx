const labels: Record<string, string> = {
  DRAFT: "Draft",
  READY: "Ready",
  IN_PROGRESS: "In Progress",
  BLOCKED: "Blocked",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  PENDING: "Pending",
  IN_REVIEW: "In Review",
  WAIVED: "Waived",
  SKIPPED: "Skipped",
};

export function FormationStatusBadge({ status }: { status: string }) {
  return (
    <span className="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.15em] text-slate-300">
      {labels[status] ?? status}
    </span>
  );
}
