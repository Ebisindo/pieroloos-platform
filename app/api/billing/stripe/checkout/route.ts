import { NextResponse } from "next/server";
import { z } from "zod";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { enforceRateLimit, PORTAL_INTERACTION_LIMIT } from "@/lib/http/rate-limit";
import { prisma } from "@/lib/db/prisma";
import { BillingInvoiceStatus, BillingPaymentStatus, Prisma } from "@prisma/client";
import { paymentFeatureEnabled } from "@/lib/domain/payment-gateway";
import { randomUUID } from "node:crypto";

const inputSchema = z.object({ invoiceId: z.string().min(1).max(128) }).strict();
type StripeSessionResponse = { id?: string; url?: string | null; error?: { message?: string } };

export async function POST(request: Request) {
  if (hasInvalidRequestOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const context = await getWorkspaceContext();
  if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!context.activeWorkspace || !context.principal) return NextResponse.json({ error: "Select an authorized workspace." }, { status: 409 });
  if (!context.principal.permissions.includes("workspace:read")) return NextResponse.json({ error: "Workspace access required." }, { status: 403 });
  const limited = await enforceRateLimit(PORTAL_INTERACTION_LIMIT, context.userId);
  if (limited) return limited;
  if (!paymentFeatureEnabled("STRIPE")) return NextResponse.json({ error: "Stripe payments are disabled or not configured." }, { status: 503 });
  if (!process.env.STRIPE_SECRET_KEY || !process.env.NEXTAUTH_URL) return NextResponse.json({ error: "Stripe checkout configuration is incomplete." }, { status: 503 });

  let body: unknown;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > 8 * 1024) return NextResponse.json({ error: "Request body is too large." }, { status: 413 });
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid invoice reference." }, { status: 422 });

  const invoice = await prisma.billingInvoice.findFirst({
    where: { id: parsed.data.invoiceId, organizationId: context.activeWorkspace.organizationId, status: BillingInvoiceStatus.OPEN, amountRemainingMinor: { gt: 0n } },
    select: { id: true, currency: true, amountRemainingMinor: true, invoiceNumber: true },
  });
  if (!invoice) return NextResponse.json({ error: "Open invoice not found." }, { status: 404 });
  if (invoice.amountRemainingMinor > BigInt(Number.MAX_SAFE_INTEGER)) return NextResponse.json({ error: "Invoice amount exceeds supported checkout bounds." }, { status: 422 });
  if (!/^[a-zA-Z]{3}$/.test(invoice.currency)) return NextResponse.json({ error: "Invoice currency is invalid." }, { status: 422 });
  let base: URL;
  try {
    base = new URL(process.env.NEXTAUTH_URL);
    if (base.protocol !== "https:" && !(base.protocol === "http:" && base.hostname === "localhost")) throw new Error("Invalid URL");
  } catch {
    return NextResponse.json({ error: "Canonical application URL must be HTTPS (except localhost)." }, { status: 503 });
  }

  const paymentId = randomUUID();
  let session: StripeSessionResponse;
  try {
    const params = new URLSearchParams();
    params.set("mode", "payment");
    params.set("success_url", new URL("/billing?checkout=return", base).toString());
    params.set("cancel_url", new URL("/billing?checkout=cancelled", base).toString());
    params.set("client_reference_id", paymentId);
    params.set("metadata[paymentId]", paymentId);
    params.set("metadata[invoiceId]", invoice.id);
    params.set("metadata[organizationId]", context.activeWorkspace.organizationId);
    params.set("line_items[0][quantity]", "1");
    params.set("line_items[0][price_data][currency]", invoice.currency.toLowerCase());
    params.set("line_items[0][price_data][unit_amount]", invoice.amountRemainingMinor.toString());
    params.set("line_items[0][price_data][product_data][name]", invoice.invoiceNumber ? `PieroloOS invoice ${invoice.invoiceNumber}` : "PieroloOS invoice payment");
    params.set("payment_intent_data[metadata][paymentId]", paymentId);
    params.set("payment_intent_data[metadata][invoiceId]", invoice.id);
    params.set("payment_intent_data[metadata][organizationId]", context.activeWorkspace.organizationId);
    // Stripe's supported REST API is used without adding an unpinned package dependency.
    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": `pierolo-checkout-${paymentId}`,
      },
      body: params,
      cache: "no-store",
    });
    session = await response.json() as StripeSessionResponse;
    if (!response.ok || !session.id || !session.url) {
      console.error("Stripe checkout API returned an unsuccessful result.");
      return NextResponse.json({ error: "Stripe checkout could not be created." }, { status: 502 });
    }
  } catch {
    console.error("Stripe checkout request failed.");
    return NextResponse.json({ error: "Stripe checkout could not be created." }, { status: 502 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.billingPayment.create({
        data: {
          id: paymentId,
          organizationId: context.activeWorkspace!.organizationId,
          invoiceId: invoice.id,
          provider: "stripe",
          providerPaymentId: session.id!,
          status: BillingPaymentStatus.PENDING,
          currency: invoice.currency.toUpperCase(),
          amountMinor: invoice.amountRemainingMinor,
        },
      });
      await tx.platformAuditEvent.create({
        data: {
          actorUserId: context.userId!,
          actorRole: "CUSTOMER",
          action: "STRIPE_CHECKOUT_CREATED",
          subjectType: "BILLING_PAYMENT",
          subjectId: paymentId,
          outcome: "SUCCESS",
          details: { invoiceId: invoice.id, organizationId: context.activeWorkspace!.organizationId, sessionId: session.id } as Prisma.InputJsonObject,
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch {
    console.error("Could not persist Stripe checkout association.");
    // An orphan session cannot be confirmed by this platform because its local
    // payment reference is not persisted. Do not send the user to a checkout that cannot be reconciled.
    return NextResponse.json({ error: "Checkout could not be associated with an invoice. Do not complete this session; contact support." }, { status: 500 });
  }
  return NextResponse.json({ data: { checkoutUrl: session.url, sessionId: session.id } }, { status: 201 });
}
