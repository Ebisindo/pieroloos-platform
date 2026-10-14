import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { BillingInvoiceStatus, BillingPaymentStatus, BillingWebhookStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { verifyStripeWebhookSignature } from "@/lib/domain/stripe-webhook-signature";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

type StripeEventPayload = {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
};

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.length ? value : null;
}

export async function POST(request: Request) {
  if (process.env.PAYMENTS_ENABLED !== "true" || process.env.STRIPE_PAYMENTS_ENABLED !== "true") {
    return errorResponse("Stripe webhook processing is disabled.", 503);
  }
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return errorResponse("Stripe webhook configuration is incomplete.", 503);
  const signature = request.headers.get("stripe-signature");
  if (!signature) return errorResponse("Missing Stripe signature.", 400);
  const rawBody = await request.text().catch(() => "");
  if (!rawBody || Buffer.byteLength(rawBody, "utf8") > 1024 * 1024) return errorResponse("Invalid webhook body.", 400);
  if (!verifyStripeWebhookSignature(rawBody, signature, secret)) return errorResponse("Invalid or expired Stripe signature.", 400);

  let event: StripeEventPayload;
  try {
    event = JSON.parse(rawBody) as StripeEventPayload;
  } catch {
    return errorResponse("Invalid Stripe event payload.", 400);
  }
  if (!event.id || !event.type || !event.data?.object || typeof event.data.object !== "object") {
    return errorResponse("Malformed Stripe event.", 400);
  }
  const payloadHash = createHash("sha256").update(rawBody).digest("hex");
  const object = event.data.object;
  const metadata = object.metadata && typeof object.metadata === "object"
    ? object.metadata as Record<string, unknown> : {};
  let paymentId = stringValue(metadata.paymentId);
  const invoiceId = stringValue(metadata.invoiceId);
  const organizationId = stringValue(metadata.organizationId);

  // Charge objects do not always include PaymentIntent metadata. Resolve the signed
  // charge's PaymentIntent over Stripe's authenticated API before processing a refund.
  if (event.type === "charge.refunded" && !paymentId) {
    const paymentIntentId = stringValue(object.payment_intent);
    if (!paymentIntentId) return errorResponse("Refund event is missing its PaymentIntent reference.", 400);
    try {
      const response = await fetch(`https://api.stripe.com/v1/payment_intents/${encodeURIComponent(paymentIntentId)}`, {
        headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
        cache: "no-store",
      });
      if (!response.ok) return errorResponse("Unable to resolve refund payment metadata; retry later.", 500);
      const intent = await response.json() as { metadata?: Record<string, unknown> };
      paymentId = stringValue(intent.metadata?.paymentId);
      if (!paymentId) return errorResponse("Refund PaymentIntent is not associated with a local payment.", 400);
    } catch {
      return errorResponse("Unable to resolve refund payment metadata; retry later.", 500);
    }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.billingWebhookEvent.findUnique({
        where: { provider_providerEventId: { provider: "stripe", providerEventId: event.id } },
        select: { id: true, status: true, payloadHash: true },
      });
      if (existing?.status === BillingWebhookStatus.PROCESSED) {
        if (existing.payloadHash !== payloadHash) throw new Error("STRIPE_EVENT_ID_PAYLOAD_CONFLICT");
        return { duplicate: true };
      }
      if (!existing) {
        await tx.billingWebhookEvent.create({
          data: {
            provider: "stripe", providerEventId: event.id, eventType: event.type,
            payloadHash, status: BillingWebhookStatus.PROCESSING, attemptCount: 1,
          },
        });
      } else {
        await tx.billingWebhookEvent.update({
          where: { id: existing.id },
          data: { status: BillingWebhookStatus.PROCESSING, attemptCount: { increment: 1 }, payloadHash, lastErrorCode: null },
        });
      }

      if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
        const sessionId = stringValue(object.id);
        const paymentStatus = stringValue(object.payment_status);
        const amountTotal = object.amount_total;
        const currency = stringValue(object.currency)?.toLowerCase();
        if (paymentStatus !== "paid") {
          await tx.billingWebhookEvent.update({
            where: { provider_providerEventId: { provider: "stripe", providerEventId: event.id } },
            data: { status: BillingWebhookStatus.PROCESSED, processedAt: new Date() },
          });
          return { pending: true };
        }
        if (!sessionId || !paymentId || !invoiceId || !organizationId ||
            typeof amountTotal !== "number" || !Number.isSafeInteger(amountTotal) || amountTotal <= 0 || !currency) {
          await tx.billingWebhookEvent.update({
            where: { provider_providerEventId: { provider: "stripe", providerEventId: event.id } },
            data: { status: BillingWebhookStatus.FAILED, lastErrorCode: "MISSING_METADATA_OR_AMOUNT" },
          });
          return { invalid: true };
        }
        const payment = await tx.billingPayment.findFirst({
          where: { id: paymentId, organizationId, invoiceId, provider: "stripe", providerPaymentId: sessionId, status: BillingPaymentStatus.PENDING },
          select: { id: true, currency: true, amountMinor: true, invoiceId: true },
        });
        if (!payment || payment.amountMinor !== BigInt(amountTotal) || payment.currency.toLowerCase() !== currency) {
          await tx.billingWebhookEvent.update({
            where: { provider_providerEventId: { provider: "stripe", providerEventId: event.id } },
            data: { status: BillingWebhookStatus.FAILED, lastErrorCode: "PAYMENT_MISMATCH" },
          });
          return { invalid: true };
        }
        const invoice = await tx.billingInvoice.findFirst({
          where: { id: payment.invoiceId!, organizationId, status: BillingInvoiceStatus.OPEN },
          select: { id: true, amountRemainingMinor: true, currency: true },
        });
        if (!invoice || invoice.amountRemainingMinor !== payment.amountMinor ||
            invoice.currency.toLowerCase() !== currency) {
          await tx.billingWebhookEvent.update({
            where: { provider_providerEventId: { provider: "stripe", providerEventId: event.id } },
            data: { status: BillingWebhookStatus.FAILED, lastErrorCode: "INVOICE_STATE_MISMATCH" },
          });
          return { invalid: true };
        }
        const paymentUpdated = await tx.billingPayment.updateMany({
          where: { id: payment.id, organizationId, status: BillingPaymentStatus.PENDING, providerPaymentId: sessionId },
          data: { status: BillingPaymentStatus.SUCCEEDED, paidAt: new Date() },
        });
        if (paymentUpdated.count !== 1) return { duplicate: true };
        const invoiceUpdated = await tx.billingInvoice.updateMany({
          where: { id: invoice.id, organizationId, status: BillingInvoiceStatus.OPEN, amountRemainingMinor: payment.amountMinor },
          data: {
            amountPaidMinor: { increment: payment.amountMinor }, amountRemainingMinor: { decrement: payment.amountMinor },
            status: BillingInvoiceStatus.PAID, paidAt: new Date(),
          },
        });
        if (invoiceUpdated.count !== 1) throw new Error("STRIPE_INVOICE_RACE");
        await tx.platformAuditEvent.create({
          data: {
            actorRole: "SYSTEM", action: "STRIPE_PAYMENT_CONFIRMED", subjectType: "BILLING_PAYMENT",
            subjectId: payment.id, outcome: "SUCCESS",
            details: { eventId: event.id, invoiceId, organizationId, sessionId },
          },
        });
      } else if (event.type === "checkout.session.async_payment_failed" || event.type === "payment_intent.payment_failed") {
        const id = paymentId;
        if (id) {
          const payment = await tx.billingPayment.findFirst({ where: { id, organizationId: organizationId ?? undefined, provider: "stripe", status: BillingPaymentStatus.PENDING }, select: { id: true } });
          if (payment) await tx.billingPayment.update({
            where: { id: payment.id }, data: { status: BillingPaymentStatus.FAILED, failureCode: "STRIPE_PAYMENT_FAILED" },
          });
        }
      } else if (event.type === "charge.refunded") {
        const chargeId = stringValue(object.id);
        const refundAmount = object.amount_refunded;
        const id = paymentId;
        if (id && chargeId && typeof refundAmount === "number" && Number.isSafeInteger(refundAmount) && refundAmount > 0) {
          const payment = await tx.billingPayment.findFirst({ where: { id, provider: "stripe" }, select: { id: true, amountMinor: true } });
          if (payment) {
            const refund = BigInt(refundAmount);
            if (refund > payment.amountMinor) throw new Error("STRIPE_REFUND_EXCEEDS_PAYMENT");
            await tx.billingPayment.update({
              where: { id }, data: {
                refundedAmountMinor: refund,
                status: refund >= payment.amountMinor ? BillingPaymentStatus.REFUNDED : BillingPaymentStatus.PARTIALLY_REFUNDED,
              },
            });
            await tx.platformAuditEvent.create({
              data: {
                actorRole: "SYSTEM", action: "STRIPE_CHARGE_REFUNDED",
                subjectType: "BILLING_PAYMENT", subjectId: id, outcome: "SUCCESS",
                details: { eventId: event.id, chargeId, amountRefundedMinor: refundAmount },
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
    if ("invalid" in result && result.invalid) return errorResponse("Webhook did not match a pending invoice payment.", 400);
    return NextResponse.json({ received: true, ...result });
  } catch (error) {
    console.error("Stripe webhook processing failed.", error instanceof Error ? error.message : "unknown");
    return errorResponse("Webhook processing failed; retry later.", 500);
  }
}
