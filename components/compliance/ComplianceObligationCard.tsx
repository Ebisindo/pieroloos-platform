import type { ComplianceObligation } from "@/lib/domain/compliance";
import { ComplianceStatusBadge } from "./ComplianceStatusBadge";

export function ComplianceObligationCard({obligation}:{obligation:Pick<ComplianceObligation,"title"|"description"|"status"|"dueAt"|"professionalReviewRequired">}) {
  return <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 backdrop-blur">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="font-medium text-white">{obligation.title}</h3>
      {obligation.description && <p className="mt-1 text-sm text-white/55">{obligation.description}</p>}</div>
      <ComplianceStatusBadge status={obligation.status}/>
    </div>
    <div className="mt-4 flex gap-4 text-xs text-white/50">
      <span>Due: {obligation.dueAt ? obligation.dueAt.toLocaleDateString() : "No fixed date"}</span>
      {obligation.professionalReviewRequired && <span>Professional review required</span>}
    </div>
  </article>;
}
