import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { BillingInvoiceStatus, BillingPaymentStatus, BillingWebhookStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function verifiedStripeEvent(rawBody: string, signatureHeader: string, secret: string): boolean {
  const parts = signatureHeader.split(",").map((part) => part.trim().split("=", 2));
  const timestampValue = parts.find(([key]) => key === "t")?.[1];
  const signatures = parts.filter(([key]) => key === "v1").map(([, value]) => value).filter(Boolean);
  if (!timestampValue || !/^\d+$/.test(timestampValue) || !signatures.length) return false;
  const timestamp = Number(timestampValue);
  // Stripe's documented default tolerance is five minutes. Reject stale/future events.
  if (!Number.isSafeInteger(timestamp) || Math.abs(Math.floor(Date.now() / 1000) - timestamp) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${timestampValue}.${rawBody}`, "utf8").digest();
  return signatures.some((candidate) => {
    if (!/^[0-9a-f]{64}$/i.test(candidate)) return false;
    const actual = Buffer.from(candidate, "hex");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  });
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
  if (!verifiedStripeEvent(rawBody, signature, secret)) return errorResponse("Invalid or expired Stripe signature.", 400);

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
  const paymentId = stringValue(metadata.paymentId);
  const invoiceId = stringValue(metadata.invoiceId);
  const organizationId = stringValue(metadata.organizationId);

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
        const refunded = object.refunded;
        const id = paymentId;
        if (id && chargeId && typeof refundAmount === "number" && Number.isSafeInteger(refundAmount) && refundAmount >= 0 && refunded === true) {
          const payment = await tx.billingPayment.findFirst({ where: { id, provider: "stripe" }, select: { id: true, amountMinor: true } });
          if (payment) {
            const refund = BigInt(refundAmount);
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
