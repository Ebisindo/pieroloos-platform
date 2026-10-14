import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader, GlassPanel, StatusBadge } from "@/components/ui/primitives";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { prisma } from "@/lib/db/prisma";
import { BillingInvoiceStatus } from "@prisma/client";
import { paymentFeatureEnabled } from "@/lib/domain/payment-gateway";

function money(amount: bigint, currency: string) {
  const n = Number(amount);
  if (!Number.isSafeInteger(n)) return `${currency} amount unavailable`;
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n / 100);
}

function tone(status: string): "neutral" | "success" | "warning" | "danger" | "info" {
  if (status === "SUCCEEDED" || status === "PAID") return "success";
  if (status === "FAILED" || status === "REFUNDED") return "danger";
  if (status === "PENDING" || status === "OPEN") return "warning";
  return "info";
}

export default async function BillingPage() {
  const context = await getWorkspaceContext();
  if (!context.userId) redirect("/signin?callbackUrl=/billing");
  if (!context.activeWorkspace || !context.principal) {
    return <div className="page-stack"><PageHeader eyebrow="BILLING" title="Billing and payments" description="Select an authorized workspace to view invoices." /><GlassPanel><p>No active workspace selected.</p><Link className="button button-secondary" href="/settings">Choose workspace</Link></GlassPanel></div>;
  }
  if (!context.principal.permissions.includes("workspace:read")) redirect("/command-center");

  const invoices = await prisma.billingInvoice.findMany({
    where: { organizationId: context.activeWorkspace.organizationId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, invoiceNumber: true, status: true, currency: true, amountDueMinor: true, amountPaidMinor: true, amountRemainingMinor: true, dueAt: true, createdAt: true },
  });
  const payments = await prisma.billingPayment.findMany({
    where: { organizationId: context.activeWorkspace.organizationId },
    orderBy: { createdAt: "desc" }, take: 50,
    select: { id: true, invoiceId: true, provider: true, status: true, currency: true, amountMinor: true, createdAt: true, paidAt: true },
  });
  const stripeEnabled = paymentFeatureEnabled("STRIPE");
  const bankEnabled = paymentFeatureEnabled("BANK_TRANSFER");
  const cryptoEnabled = paymentFeatureEnabled("CRYPTO");

  return (
    <div className="page-stack">
      <PageHeader eyebrow="BILLING" title="Billing and payments" description={`Invoices and payment claims for ${context.activeWorkspace.name}. Payment claims do not grant paid access until independently verified.`} />
      <GlassPanel>
        <h2>Available payment methods</h2>
        <p className="muted">Payment providers are disabled by default until deployment configuration, business eligibility, and verification controls have been checked.</p>
        <div className="payment-method-grid">
          <div><h3>Stripe checkout</h3><StatusBadge tone={stripeEnabled ? "success" : "warning"}>{stripeEnabled ? "Configured" : "Unavailable"}</StatusBadge><p>Secure hosted checkout for eligible open invoices.</p></div>
          <div><h3>Bank transfer</h3><StatusBadge tone={bankEnabled ? "success" : "warning"}>{bankEnabled ? "Configured" : "Unavailable"}</StatusBadge><p>Claims remain pending until finance independently confirms receipt.</p></div>
          <div><h3>Cryptocurrency</h3><StatusBadge tone={cryptoEnabled ? "success" : "warning"}>{cryptoEnabled ? "Configured" : "Unavailable"}</StatusBadge><p>Token and network verification must be configured and verified.</p></div>
        </div>
      </GlassPanel>

      <section className="page-stack" aria-labelledby="invoice-list-heading">
        <div className="section-header"><div><h2 id="invoice-list-heading">Invoices</h2><p>Only open invoices with an outstanding balance can be paid.</p></div></div>
        {invoices.length ? <GlassPanel className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Invoice</th><th>Due</th><th>Amount due</th><th>Paid</th><th>Status</th><th>Action</th></tr></thead><tbody>{invoices.map((invoice) => <tr key={invoice.id}><td>{invoice.invoiceNumber ?? invoice.id}</td><td>{invoice.dueAt ? invoice.dueAt.toLocaleDateString("en-GB", { timeZone: "UTC" }) : "—"}</td><td>{money(invoice.amountDueMinor, invoice.currency)}</td><td>{money(invoice.amountPaidMinor, invoice.currency)}</td><td><StatusBadge tone={tone(invoice.status)}>{invoice.status}</StatusBadge></td><td>{invoice.status === BillingInvoiceStatus.OPEN && invoice.amountRemainingMinor > 0n ? <div className="page-actions">{stripeEnabled ? <StripeCheckoutButton invoiceId={invoice.id} /> : null}{bankEnabled ? <ClaimButton invoiceId={invoice.id} method="BANK_TRANSFER" /> : null}{cryptoEnabled ? <Link className="button button-secondary" href={`/billing/crypto?invoiceId=${encodeURIComponent(invoice.id)}`}>Crypto options</Link> : null}{!stripeEnabled && !bankEnabled && !cryptoEnabled ? <span className="muted">Not enabled</span> : null}</div> : "—"}</td></tr>)}</tbody></table></GlassPanel> : <GlassPanel><p>No invoices found for this organization.</p></GlassPanel>}
      </section>

      <section className="page-stack" aria-labelledby="payment-history-heading">
        <div className="section-header"><div><h2 id="payment-history-heading">Payment history</h2><p>Payment records and submission claims for this organization.</p></div></div>
        {payments.length ? <GlassPanel className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Reference</th><th>Invoice</th><th>Method</th><th>Amount</th><th>Status</th><th>Created</th></tr></thead><tbody>{payments.map((payment) => <tr key={payment.id}><td><code>{payment.provider === "stripe" ? payment.id.slice(0, 12) : payment.id}</code></td><td>{payment.invoiceId ?? "—"}</td><td>{payment.provider ?? "Unknown"}</td><td>{money(payment.amountMinor, payment.currency)}</td><td><StatusBadge tone={tone(payment.status)}>{payment.status}</StatusBadge></td><td>{payment.createdAt.toLocaleString("en-GB", { timeZone: "UTC" })}</td></tr>)}</tbody></table></GlassPanel> : <GlassPanel><p>No payment records yet.</p></GlassPanel>}
      </section>
    </div>
  );
}

function StripeCheckoutButton({ invoiceId }: { invoiceId: string }) {
  return <form action="/api/billing/stripe/checkout" method="POST" className="inline-form" data-invoice-id={invoiceId}><button className="button button-primary" type="button" onClick={undefined}>Pay with Stripe</button><span className="sr-only">Stripe checkout is started by the checkout API.</span></form>;
}

function ClaimButton({ invoiceId, method }: { invoiceId: string; method: "BANK_TRANSFER" }) {
  return <form action="/api/billing/payments" method="POST" className="inline-form" data-invoice-id={invoiceId} data-method={method}><span className="muted">Use the payment API to submit a claim.</span></form>;
}
