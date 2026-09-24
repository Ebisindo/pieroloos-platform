import type { ComplianceStatus } from "@/lib/domain/compliance";
export function ComplianceStatusBadge({status}:{status:ComplianceStatus}) {
  return <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/80">
    {status.replaceAll("_"," ")}
  </span>;
}
