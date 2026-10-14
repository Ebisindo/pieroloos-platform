import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader, GlassPanel } from "@/components/ui/primitives";
import { CryptoPaymentForm } from "@/components/billing/CryptoPaymentForm";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { canManageBilling } from "@/lib/auth/billing-access";
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
  if (!canManageBilling(context.principal.role)) redirect("/command-center");
  const { invoiceId } = await searchParams;
  if (!invoiceId || invoiceId.length > 128) {
    return <div className="page-stack"><PageHeader eyebrow="CRYPTO PAYMENT" title="Cryptocurrency payment" description="An invoice reference is required." /><Link className="button button-secondary" href="/billing">Return to billing</Link></div>;
  }
  const invoice = await prisma.billingInvoice.findFirst({
    where: { id: invoiceId, organizationId: context.activeWorkspace.organizationId, status: BillingInvoiceStatus.OPEN, currency: "USD", amountRemainingMinor: { gt: BigInt(0) } },
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
        invoice={{ id: invoice.id, invoiceNumber: invoice.invoiceNumber, currency: "USD", amountRemainingMinor: invoice.amountRemainingMinor.toString(), expectedTokenAmountBaseUnits: (invoice.amountRemainingMinor * BigInt(10000)).toString(), expectedTokenAmount: `${invoice.amountRemainingMinor / BigInt(100)}.${(invoice.amountRemainingMinor % BigInt(100)).toString().padStart(2, "0")}` }}
        rails={rails}
      />
    </div>
  );
}
