import { NextResponse } from "next/server";
import { z } from "zod";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { canManageBilling } from "@/lib/auth/billing-access";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { enforceRateLimit, PORTAL_INTERACTION_LIMIT } from "@/lib/http/rate-limit";
import { listOpenInvoices, listPayments, submitCryptoPaymentClaim, PaymentGatewayError } from "@/lib/services/payment-gateway";
import { paymentFeatureEnabled } from "@/lib/domain/payment-gateway";
import { paymentControlConfiguration } from "@/lib/domain/payment-gateway";

const claimSchema = z.object({
  paymentId: z.string().min(1).max(128),
  transactionReference: z.string().trim().min(32).max(160),
}).strict();

function errorResponse(error: unknown) {
  if (error instanceof PaymentGatewayError) {
    const status = {
      DISABLED: 503, NOT_FOUND: 404, NOT_PAYABLE: 409, INVALID: 422,
      CONFLICT: 409, FORBIDDEN: 403, NOT_CONFIGURED: 503,
    }[error.code];
    return NextResponse.json({ error: error.message, code: error.code }, { status });
  }
  console.error("Payment operation failed.");
  return NextResponse.json({ error: "Payment operation could not be completed." }, { status: 500 });
}

export async function GET() {
  const context = await getWorkspaceContext();
  if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!context.principal || !context.activeWorkspace) {
    return NextResponse.json({ error: "Select an authorized workspace." }, { status: 409 });
  }
  if (!canManageBilling(context.principal.role)) {
    return NextResponse.json({ error: "Workspace read access required." }, { status: 403 });
  }
  try {
    const [invoices, payments] = await Promise.all([
      listOpenInvoices(context.activeWorkspace.organizationId),
      listPayments(context.activeWorkspace.organizationId),
    ]);
    return NextResponse.json({
      data: { invoices, payments },
      availableMethods: {
        stripe: paymentFeatureEnabled("STRIPE"),
        bankTransfer: paymentFeatureEnabled("BANK_TRANSFER"),
        crypto: paymentFeatureEnabled("CRYPTO"),
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  if (hasInvalidRequestOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const context = await getWorkspaceContext();
  if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!context.principal || !context.activeWorkspace) {
    return NextResponse.json({ error: "Select an authorized workspace." }, { status: 409 });
  }
  if (!canManageBilling(context.principal.role)) {
    return NextResponse.json({ error: "Billing administrator access required." }, { status: 403 });
  }
  const limited = await enforceRateLimit(PORTAL_INTERACTION_LIMIT, context.userId);
  if (limited) return limited;

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > 8 * 1024) return NextResponse.json({ error: "Request body is too large." }, { status: 413 });
  let body: unknown;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > 8 * 1024) return NextResponse.json({ error: "Request body is too large." }, { status: 413 });
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = claimSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed.", issues: parsed.error.flatten().fieldErrors }, { status: 422 });

  const paymentControls = paymentControlConfiguration();
  if (!paymentControls.paymentsEnabled || !paymentControls.cryptoEnabled || !paymentFeatureEnabled("CRYPTO")) {
    return NextResponse.json({ error: "Cryptocurrency payments are currently unavailable." }, { status: 503 });
  }

  try {
    const payment = await submitCryptoPaymentClaim({
      userId: context.userId,
      organizationId: context.activeWorkspace.organizationId,
      paymentId: parsed.data.paymentId,
      transactionReference: parsed.data.transactionReference,
    });
    return NextResponse.json({
      data: payment,
      message: "Transaction claim recorded as pending manual verification. This submission does not confirm receipt of funds or activate paid access.",
    }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
