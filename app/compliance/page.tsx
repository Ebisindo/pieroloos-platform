import { ComplianceControlCenter } from "@/components/compliance/ComplianceControlCenter";
import type { ComplianceControlSnapshot } from "@/lib/domain/compliance-control";

export default function CompliancePage() {
  const snapshot: ComplianceControlSnapshot = {
    generatedAt: new Date(),
    portfolioStatus: "HEALTHY",
    progressPercent: 0,
    totals: {
      obligations: 0, compliant: 0, dueSoon: 0, overdue: 0,
      blocked: 0, awaitingEvidence: 0, awaitingReview: 0,
    },
    alerts: [],
  };

  return (
    <main className="mx-auto max-w-7xl p-6">
      <ComplianceControlCenter snapshot={snapshot} />
    </main>
  );
}
