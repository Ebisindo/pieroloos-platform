import { NextResponse } from "next/server";
import { BillingInvoiceStatus } from "@prisma/client";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { canManageBilling } from "@/lib/auth/billing-access";
import { paymentControlConfiguration } from "@/lib/domain/payment-gateway";
import { cryptoRailConfiguration, paymentFeatureEnabled } from "@/lib/domain/payment-gateway";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const context = await getWorkspaceContext();
  if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!context.activeWorkspace || !context.principal) return NextResponse.json({ error: "Select an authorized workspace." }, { status: 409 });
  if (!canManageBilling(context.principal.role)) return NextResponse.json({ error: "Billing administrator access required." }, { status: 403 });
  const invoiceId = new URL(request.url).searchParams.get("invoiceId");
  if (!invoiceId || invoiceId.length > 128) return NextResponse.json({ error: "Invoice reference is required." }, { status: 422 });

  const invoice = await prisma.billingInvoice.findFirst({
    where: { id: invoiceId, organizationId: context.activeWorkspace.organizationId, status: BillingInvoiceStatus.OPEN, currency: "USD", amountRemainingMinor: { gt: BigInt(0) } },
    select: { id: true, invoiceNumber: true, currency: true, amountRemainingMinor: true, amountPaidMinor: true, amountDueMinor: true },
  });
  if (!invoice) return NextResponse.json({ error: "Open USD invoice not found in the active organization." }, { status: 404 });

  const paymentControls = paymentControlConfiguration();
  const enabled = paymentControls.paymentsEnabled && paymentControls.cryptoEnabled && paymentFeatureEnabled("CRYPTO")
    ? cryptoRailConfiguration().filter((rail) => rail.enabled && rail.tokenDecimals !== null && rail.tokenDecimals >= 2 && rail.tokenDecimals <= 18 && rail.address && rail.tokenIdentifier)
    : [];
  return NextResponse.json({
    data: {
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        currency: invoice.currency,
        amountRemainingMinor: invoice.amountRemainingMinor.toString(),
        amountUsd: `${invoice.amountRemainingMinor / BigInt(100)}.${(invoice.amountRemainingMinor % BigInt(100)).toString().padStart(2, "0")}`,
      },
      verificationMode: enabled.length ? "MANUAL_FINANCE_RECONCILIATION" : "DISABLED",
      rails: enabled.map(({ asset, network, address, tokenIdentifier, tokenDecimals }) => ({
        asset, network, address, tokenIdentifier, tokenDecimals: tokenDecimals ?? 0,
        expectedTokenAmountBaseUnits: (invoice.amountRemainingMinor * (BigInt(10) ** BigInt((tokenDecimals ?? 0) - 2))).toString(),
      })),
    },
  });
}
