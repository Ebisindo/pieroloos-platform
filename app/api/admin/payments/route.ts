import { BillingPaymentStatus, PlatformPermission } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentPlatformActor } from "@/lib/auth/platform-access";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { enforceRateLimit, PLATFORM_ADMIN_MUTATION_LIMIT } from "@/lib/http/rate-limit";
import { prisma } from "@/lib/db/prisma";
import { reconcileBankTransfer, reconcileCryptoPayment, PaymentGatewayError } from "@/lib/services/payment-gateway";

const actionSchema = z.object({
  action: z.enum(["APPROVE_BANK_TRANSFER", "REJECT_BANK_TRANSFER", "APPROVE_CRYPTO_PAYMENT", "REJECT_CRYPTO_PAYMENT"]),
  paymentId: z.string().min(1).max(128),
  organizationId: z.string().min(1).max(128),
  receivedAmountMinor: z.string().regex(/^[1-9][0-9]{0,17}$/).optional(),
  receivedCurrency: z.string().regex(/^[A-Z]{3}$/).optional(),
  receivedAmountBaseUnits: z.string().regex(/^[1-9][0-9]{0,35}$/).optional(),
  bankTransactionReference: z.string().trim().min(4).max(160).optional(),
  evidenceReference: z.string().trim().min(4).max(500),
  reason: z.string().trim().min(8).max(500),
}).strict();

function allowed(actor: { isSuperAdmin: boolean; permissions: PlatformPermission[] }) {
  return actor.isSuperAdmin || actor.permissions.includes(PlatformPermission.DASHBOARD_READ);
}

export async function GET() {
  const actor = await getCurrentPlatformActor();
  if (!actor) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!allowed(actor)) return NextResponse.json({ error: "Financial administration access required." }, { status: 403 });

  try {
    const where = actor.isSuperAdmin ? {} : { organizationId: { in: actor.organizationIds } };
    const [pending, recent] = await Promise.all([
      prisma.billingPayment.findMany({
        where: { ...where, status: BillingPaymentStatus.PENDING },
        orderBy: { createdAt: "asc" }, take: 100,
        select: { id: true, organizationId: true, invoiceId: true, provider: true, providerPaymentId: true, currency: true, amountMinor: true, createdAt: true },
      }),
      prisma.billingPayment.findMany({
        where,
        orderBy: { createdAt: "desc" }, take: 100,
        select: { id: true, organizationId: true, invoiceId: true, provider: true, providerPaymentId: true, status: true, currency: true, amountMinor: true, refundedAmountMinor: true, createdAt: true, paidAt: true },
      }),
    ]);
    await prisma.platformAuditEvent.create({
      data: {
        actorUserId: actor.userId, actorRole: actor.isSuperAdmin ? "SUPER_ADMIN" : "PLATFORM_ADMIN",
        action: "BILLING_PAYMENTS_READ", subjectType: "BILLING_PAYMENT", outcome: "SUCCESS",
        details: { pendingCount: pending.length, recentCount: recent.length },
      },
    });
    return NextResponse.json({ data: { pending, recent } });
  } catch {
    console.error("Unable to list payment records.");
    return NextResponse.json({ error: "Unable to load payment records." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (hasInvalidRequestOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const actor = await getCurrentPlatformActor();
  if (!actor) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!actor.isSuperAdmin) return NextResponse.json({ error: "Only the platform Super Administrator may reconcile payment claims." }, { status: 403 });
  const limited = await enforceRateLimit(PLATFORM_ADMIN_MUTATION_LIMIT, actor.userId);
  if (limited) return limited;

  let body: unknown;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > 8 * 1024) return NextResponse.json({ error: "Request body is too large." }, { status: 413 });
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed.", issues: parsed.error.flatten().fieldErrors }, { status: 422 });
  if (parsed.data.action === "APPROVE_BANK_TRANSFER" &&
      (!parsed.data.receivedAmountMinor || !parsed.data.receivedCurrency || !parsed.data.bankTransactionReference)) {
    return NextResponse.json({ error: "Bank approval requires exact amount, currency, bank reference, and independent evidence reference." }, { status: 422 });
  }
  if (parsed.data.action === "APPROVE_CRYPTO_PAYMENT" && !parsed.data.receivedAmountBaseUnits) {
    return NextResponse.json({ error: "Crypto approval requires the exact on-chain token amount in base units and independent chain evidence." }, { status: 422 });
  }

  try {
    if (parsed.data.action === "APPROVE_CRYPTO_PAYMENT" || parsed.data.action === "REJECT_CRYPTO_PAYMENT") {
      const result = await reconcileCryptoPayment({
        actorUserId: actor.userId,
        organizationId: parsed.data.organizationId,
        paymentId: parsed.data.paymentId,
        receivedAmountBaseUnits: BigInt(parsed.data.receivedAmountBaseUnits ?? "1"),
        decision: parsed.data.action === "APPROVE_CRYPTO_PAYMENT" ? "APPROVE" : "REJECT",
        evidenceReference: parsed.data.evidenceReference,
        reason: parsed.data.reason,
      });
      return NextResponse.json({ data: result, notice: "Recorded as a manually reconciled decision from evidence supplied by the reviewer; this API does not itself query a blockchain." });
    }
    const result = await reconcileBankTransfer({
      actorUserId: actor.userId,
      organizationId: parsed.data.organizationId,
      paymentId: parsed.data.paymentId,
      receivedAmountMinor: BigInt(parsed.data.receivedAmountMinor ?? "1"),
      receivedCurrency: parsed.data.receivedCurrency ?? "USD",
      bankTransactionReference: parsed.data.bankTransactionReference ?? "rejection",
      evidenceReference: parsed.data.evidenceReference,
      decision: parsed.data.action === "APPROVE_BANK_TRANSFER" ? "APPROVE" : "REJECT",
      reason: parsed.data.reason,
    });
    return NextResponse.json({ data: result });
  } catch (error) {
    if (error instanceof PaymentGatewayError) {
      const status = { DISABLED: 503, NOT_FOUND: 404, NOT_PAYABLE: 409, INVALID: 422, CONFLICT: 409, FORBIDDEN: 403, NOT_CONFIGURED: 503 }[error.code];
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    console.error("Payment reconciliation failed.");
    return NextResponse.json({ error: "Payment reconciliation could not be completed." }, { status: 500 });
  }
}
