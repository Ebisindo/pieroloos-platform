import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/primitives";
import { PaymentReviewPanel } from "@/components/billing/PaymentReviewPanel";
import { getCurrentPlatformActor } from "@/lib/auth/platform-access";

export const dynamic = "force-dynamic";

export default async function AdminPaymentsPage() {
  const actor = await getCurrentPlatformActor();
  if (!actor?.isSuperAdmin) notFound();
  return <div className="page-stack">
    <PageHeader eyebrow="SUPER ADMINISTRATOR" title="Payment reconciliation" description="Restricted financial review queue. Payment claims are not proof of receipt; all decisions must be supported by independent evidence and audited." />
    <PaymentReviewPanel />
  </div>;
}
