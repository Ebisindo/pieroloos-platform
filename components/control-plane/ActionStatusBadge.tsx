import type { ControlActionStatus } from "@/lib/domain/action-control";

export function ActionStatusBadge({ status }: { status: ControlActionStatus }) {
  return (
    <span className="inline-flex rounded-full border border-white/10 px-2.5 py-1 text-xs uppercase tracking-wider text-white/55">
      {status.replaceAll("_", " ")}
    </span>
  );
}
