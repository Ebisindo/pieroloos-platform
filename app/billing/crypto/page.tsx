import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader, GlassPanel } from "@/components/ui/primitives";
import { CryptoPaymentForm } from "@/components/billing/CryptoPaymentForm";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { cryptoRailConfiguration, paymentFeatureEnabled } from "@/lib/domain/payment-gateway";
import { prisma } from "@/lib/db/prisma";
import { BillingInvoiceStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function CryptoPaymentPage({ searchParams }: { searchParams: Promise<{ invoiceId?: string }> }) {
  const context = await getWorkspaceContext();
  if (!context.userId) redirect("/signin?callbackUrl=/billing/crypto");
  if (!context.activeWorkspace || !context.principal) {
    return <div className="page-stack"><PageHeader eyebrow="CRYPTO PAYMENT" title="Cryptocurrency payment" description="Choose an authorized workspace first." /><GlassPanel><Link className="button button-secondary" href="/settings">Choose workspace</Link></GlassPanel></div>;
  }
  if (!context.principal.permissions.includes("workspace:read")) redirect("/command-center");
  const { invoiceId } = await searchParams;
  if (!invoiceId || invoiceId.length > 128) {
    return <div className="page-stack"><PageHeader eyebrow="CRYPTO PAYMENT" title="Cryptocurrency payment" description="An invoice reference is required." /><Link className="button button-secondary" href="/billing">Return to billing</Link></div>;
  }
  const invoice = await prisma.billingInvoice.findFirst({
    where: { id: invoiceId, organizationId: context.activeWorkspace.organizationId, status: BillingInvoiceStatus.OPEN, currency: "USD", amountRemainingMinor: { gt: 0n } },
    select: { id: true, invoiceNumber: true, currency: true, amountRemainingMinor: true },
  });
  if (!invoice) {
    return <div className="page-stack"><PageHeader eyebrow="CRYPTO PAYMENT" title="Cryptocurrency payment" description="No payable USD invoice was found in the active organization." /><Link className="button button-secondary" href="/billing">Return to billing</Link></div>;
  }
  const rails = paymentFeatureEnabled("CRYPTO") ? cryptoRailConfiguration().filter((rail) => rail.enabled && rail.tokenDecimals === 6 && rail.address && rail.tokenIdentifier).map(({ asset, network, address, tokenIdentifier, tokenDecimals }) => ({ asset, network, address, tokenIdentifier, tokenDecimals })) : [];
  return (
    <div className="page-stack">
      <PageHeader eyebrow="BILLING / CRYPTO" title="Cryptocurrency payment" description="Instructions are available only for explicitly verified rails. Claims remain pending until independent finance reconciliation is complete." actions={<Link className="button button-secondary" href="/billing">Back to billing</Link>} />
      <CryptoPaymentForm
        invoice={{ id: invoice.id, invoiceNumber: invoice.invoiceNumber, currency: "USD", amountRemainingMinor: invoice.amountRemainingMinor.toString(), expectedTokenAmountBaseUnits: (invoice.amountRemainingMinor * 10_000n).toString(), expectedTokenAmount: `${invoice.amountRemainingMinor / 100n}.${(invoice.amountRemainingMinor % 100n).toString().padStart(2, "0")}` }}
        rails={rails}
      />
    </div>
  );
}
