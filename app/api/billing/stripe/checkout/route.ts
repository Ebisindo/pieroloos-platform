import { NextResponse } from "next/server";
import { z } from "zod";
import Stripe from "stripe";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { enforceRateLimit, PORTAL_INTERACTION_LIMIT } from "@/lib/http/rate-limit";
import { prisma } from "@/lib/db/prisma";
import { BillingInvoiceStatus, BillingPaymentStatus } from "@prisma/client";
import { paymentFeatureEnabled } from "@/lib/domain/payment-gateway";

const inputSchema = z.object({ invoiceId: z.string().min(1).max(128) }).strict();

export async function POST(request: Request) {
  if (hasInvalidRequestOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const context = await getWorkspaceContext();
  if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!context.activeWorkspace || !context.principal) return NextResponse.json({ error: "Select an authorized workspace." }, { status: 409 });
  if (!context.principal.permissions.includes("workspace:read")) return NextResponse.json({ error: "Workspace access required." }, { status: 403 });
  const limited = await enforceRateLimit(PORTAL_INTERACTION_LIMIT, context.userId);
  if (limited) return limited;
  if (!paymentFeatureEnabled("STRIPE")) return NextResponse.json({ error: "Stripe payments are disabled or not configured." }, { status: 503 });
  if (!process.env.STRIPE_SECRET_KEY || !process.env.NEXTAUTH_URL) {
    return NextResponse.json({ error: "Stripe checkout configuration is incomplete." }, { status: 503 });
  }

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

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const base = new URL(process.env.NEXTAUTH_URL);
  if (!["https:", "http://localhost"].some((prefix) => base.origin.startsWith(prefix))) {
    return NextResponse.json({ error: "Invalid canonical application URL." }, { status: 503 });
  }

  try {
    const pending = await prisma.billingPayment.create({
      data: {
        organizationId: context.activeWorkspace.organizationId,
        invoiceId: invoice.id,
        provider: "stripe",
        status: BillingPaymentStatus.PENDING,
        currency: invoice.currency.toUpperCase(),
        amountMinor: invoice.amountRemainingMinor,
      },
      select: { id: true },
    });
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{
        price_data: {
          currency: invoice.currency.toLowerCase(),
          unit_amount: Number(invoice.amountRemainingMinor),
          product_data: { name: invoice.invoiceNumber ? `PieroloOS invoice ${invoice.invoiceNumber}` : "PieroloOS invoice payment" },
        },
        quantity: 1,
      }],
      client_reference_id: pending.id,
      metadata: { paymentId: pending.id, invoiceId: invoice.id, organizationId: context.activeWorkspace.organizationId },
      payment_intent_data: { metadata: { paymentId: pending.id, invoiceId: invoice.id, organizationId: context.activeWorkspace.organizationId } },
      success_url: new URL("/billing?checkout=return", base).toString(),
      cancel_url: new URL("/billing?checkout=cancelled", base).toString(),
    }, { idempotencyKey: `pierolo-checkout-${pending.id}` });

    await prisma.billingPayment.update({
      where: { id: pending.id },
      data: { providerPaymentId: session.id },
    });
    await prisma.platformAuditEvent.create({
      data: {
        actorUserId: context.userId,
        actorRole: "CUSTOMER",
        action: "STRIPE_CHECKOUT_CREATED",
        subjectType: "BILLING_PAYMENT",
        subjectId: pending.id,
        outcome: "SUCCESS",
        details: { invoiceId: invoice.id, sessionId: session.id, organizationId: context.activeWorkspace.organizationId },
      },
    });
    return NextResponse.json({ data: { checkoutUrl: session.url, sessionId: session.id } }, { status: 201 });
  } catch (error) {
    console.error("Stripe checkout creation failed.");
    return NextResponse.json({ error: "Stripe checkout could not be created." }, { status: 502 });
  }
}
