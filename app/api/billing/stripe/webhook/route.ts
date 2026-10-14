import { createHash } from "node:crypto";
import Stripe from "stripe";
import { NextResponse } from "next/server";
import { BillingInvoiceStatus, BillingPaymentStatus, BillingWebhookStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { paymentFeatureEnabled } from "@/lib/domain/payment-gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  if (process.env.PAYMENTS_ENABLED !== "true" || process.env.STRIPE_PAYMENTS_ENABLED !== "true") {
    return errorResponse("Stripe webhook processing is disabled.", 503);
  }
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return errorResponse("Stripe webhook configuration is incomplete.", 503);
  }
  const signature = request.headers.get("stripe-signature");
  if (!signature) return errorResponse("Missing Stripe signature.", 400);
  const rawBody = await request.text().catch(() => "");
  if (!rawBody || Buffer.byteLength(rawBody, "utf8") > 1024 * 1024) return errorResponse("Invalid webhook body.", 400);

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return errorResponse("Invalid webhook signature.", 400);
  }
  const payloadHash = createHash("sha256").update(rawBody).digest("hex");

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.billingWebhookEvent.findUnique({
        where: { provider_providerEventId: { provider: "stripe", providerEventId: event.id } },
        select: { id: true, status: true },
      });
      if (existing?.status === BillingWebhookStatus.PROCESSED) return { duplicate: true };

      if (!existing) {
        await tx.billingWebhookEvent.create({
          data: {
            provider: "stripe",
            providerEventId: event.id,
            eventType: event.type,
            payloadHash,
            status: BillingWebhookStatus.PROCESSING,
            attemptCount: 1,
          },
        });
      } else {
        await tx.billingWebhookEvent.update({
          where: { id: existing.id },
          data: {
            status: BillingWebhookStatus.PROCESSING,
            attemptCount: { increment: 1 },
            payloadHash,
            lastErrorCode: null,
          },
        });
      }

      const object = event.data.object as unknown as Record<string, unknown>;
      const metadata = (object.metadata && typeof object.metadata === "object" ? object.metadata : {}) as Record<string, unknown>;
      const paymentId = typeof metadata.paymentId === "string" ? metadata.paymentId : null;
      const invoiceId = typeof metadata.invoiceId === "string" ? metadata.invoiceId : null;
      const organizationId = typeof metadata.organizationId === "string" ? metadata.organizationId : null;

      if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.payment_status !== "paid") {
          await tx.billingWebhookEvent.update({
            where: { provider_providerEventId: { provider: "stripe", providerEventId: event.id } },
            data: { status: BillingWebhookStatus.PROCESSED, processedAt: new Date() },
          });
          return { pending: true };
        }
        if (!paymentId || !invoiceId || !organizationId ||
            session.amount_total == null || !session.currency) {
          await tx.billingWebhookEvent.update({
            where: { provider_providerEventId: { provider: "stripe", providerEventId: event.id } },
            data: { status: BillingWebhookStatus.FAILED, lastErrorCode: "MISSING_METADATA_OR_AMOUNT" },
          });
          return { invalid: true };
        }
        const payment = await tx.billingPayment.findFirst({
          where: { id: paymentId, organizationId, invoiceId, provider: "stripe", status: BillingPaymentStatus.PENDING },
          select: { id: true, currency: true, amountMinor: true, invoiceId: true },
        });
        if (!payment || payment.amountMinor !== BigInt(session.amount_total) ||
            payment.currency.toLowerCase() !== session.currency.toLowerCase()) {
          await tx.billingWebhookEvent.update({
            where: { provider_providerEventId: { provider: "stripe", providerEventId: event.id } },
            data: { status: BillingWebhookStatus.FAILED, lastErrorCode: "PAYMENT_MISMATCH" },
          });
          return { invalid: true };
        }
        const updated = await tx.billingPayment.updateMany({
          where: { id: payment.id, status: BillingPaymentStatus.PENDING },
          data: { status: BillingPaymentStatus.SUCCEEDED, paidAt: new Date(), providerPaymentId: session.id },
        });
        if (updated.count !== 1) return { duplicate: true };
        const invoice = await tx.billingInvoice.findFirst({
          where: { id: payment.invoiceId!, organizationId, status: BillingInvoiceStatus.OPEN },
          select: { id: true, amountRemainingMinor: true, currency: true },
        });
        if (!invoice || invoice.amountRemainingMinor !== payment.amountMinor ||
            invoice.currency.toLowerCase() !== session.currency.toLowerCase()) {
          throw new Error("STRIPE_INVOICE_STATE_MISMATCH");
        }
        const invoiceUpdated = await tx.billingInvoice.updateMany({
          where: { id: invoice.id, organizationId, status: BillingInvoiceStatus.OPEN, amountRemainingMinor: payment.amountMinor },
          data: {
            amountPaidMinor: { increment: payment.amountMinor },
            amountRemainingMinor: { decrement: payment.amountMinor },
            status: BillingInvoiceStatus.PAID,
            paidAt: new Date(),
          },
        });
        if (invoiceUpdated.count !== 1) throw new Error("STRIPE_INVOICE_RACE");
        await tx.platformAuditEvent.create({
          data: {
            actorRole: "SYSTEM",
            action: "STRIPE_PAYMENT_CONFIRMED",
            subjectType: "BILLING_PAYMENT",
            subjectId: payment.id,
            outcome: "SUCCESS",
            details: { eventId: event.id, invoiceId, organizationId, providerPaymentId: session.id },
          },
        });
      } else if (event.type === "checkout.session.async_payment_failed" || event.type === "payment_intent.payment_failed") {
        const id = paymentId ?? (typeof metadata.paymentId === "string" ? metadata.paymentId : null);
        if (id) {
          await tx.billingPayment.updateMany({
            where: { id, status: BillingPaymentStatus.PENDING },
            data: { status: BillingPaymentStatus.FAILED, failureCode: "STRIPE_PAYMENT_FAILED" },
          });
        }
      } else if (event.type === "charge.refunded") {
        const charge = event.data.object as Stripe.Charge;
        const id = typeof charge.metadata?.paymentId === "string" ? charge.metadata.paymentId : null;
        if (id && charge.refunded) {
          const payment = await tx.billingPayment.findFirst({ where: { id, provider: "stripe" }, select: { id: true, amountMinor: true, refundedAmountMinor: true } });
          if (payment) {
            const refundAmount = BigInt(charge.amount_refunded);
            const status = refundAmount >= payment.amountMinor ? BillingPaymentStatus.REFUNDED : BillingPaymentStatus.PARTIALLY_REFUNDED;
            await tx.billingPayment.update({
              where: { id },
              data: { refundedAmountMinor: refundAmount, status },
            });
            await tx.platformAuditEvent.create({
              data: {
                actorRole: "SYSTEM", action: "STRIPE_CHARGE_REFUNDED",
                subjectType: "BILLING_PAYMENT", subjectId: id, outcome: "SUCCESS",
                details: { eventId: event.id, chargeId: charge.id, amountRefundedMinor: charge.amount_refunded },
              },
            });
          }
        }
      }
      await tx.billingWebhookEvent.update({
        where: { provider_providerEventId: { provider: "stripe", providerEventId: event.id } },
        data: { status: BillingWebhookStatus.PROCESSED, processedAt: new Date(), lastErrorCode: null },
      });
      return { processed: true };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if ("invalid" in result && result.invalid) return errorResponse("Webhook did not match a pending payment.", 400);
    return NextResponse.json({ received: true, ...result }, { status: 200 });
  } catch (error) {
    // A failed transaction rolls back the event and payment mutations; Stripe can retry safely.
    console.error("Stripe webhook processing failed.", error instanceof Error ? error.message : "unknown");
    return errorResponse("Webhook processing failed; retry later.", 500);
  }
}
