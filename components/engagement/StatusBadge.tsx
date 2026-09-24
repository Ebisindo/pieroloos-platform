import type { EngagementStatus } from "@/lib/domain/engagement";

const styles: Record<EngagementStatus, string> = {
  INTAKE: "border-cyan-300/20 bg-cyan-300/10 text-cyan-200",
  ASSESSMENT: "border-violet-300/20 bg-violet-300/10 text-violet-200",
  PLANNING: "border-indigo-300/20 bg-indigo-300/10 text-indigo-200",
  APPROVAL: "border-amber-300/20 bg-amber-300/10 text-amber-200",
  EXECUTION: "border-blue-300/20 bg-blue-300/10 text-blue-200",
  VERIFICATION: "border-teal-300/20 bg-teal-300/10 text-teal-200",
  RECORDING: "border-slate-300/20 bg-slate-300/10 text-slate-200",
  CLOSED: "border-emerald-300/20 bg-emerald-300/10 text-emerald-200",
};

export function StatusBadge({ status }: { status: EngagementStatus }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium tracking-wide ${styles[status]}`}>
      {status}
    </span>
  );
}
