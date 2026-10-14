import { NextResponse } from "next/server";
import { z } from "zod";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { enforceRateLimit, PORTAL_INTERACTION_LIMIT } from "@/lib/http/rate-limit";
import { listOpenInvoices, listPayments, createManualPaymentClaim, PaymentGatewayError } from "@/lib/services/payment-gateway";
import { paymentFeatureEnabled } from "@/lib/domain/payment-gateway";

const claimSchema = z.object({
  invoiceId: z.string().min(1).max(128),
  method: z.enum(["BANK_TRANSFER", "CRYPTO"]),
  asset: z.enum(["USDT", "USDC"]).optional(),
  network: z.enum(["TRON", "BNB_SMART_CHAIN", "ETHEREUM", "SOLANA"]).optional(),
  transactionReference: z.string().trim().min(32).max(160).optional(),
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
  if (!context.principal.permissions.includes("workspace:read")) {
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
  if (!context.principal.permissions.includes("workspace:read")) {
    return NextResponse.json({ error: "Workspace read access required." }, { status: 403 });
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

  if (!paymentFeatureEnabled(parsed.data.method)) {
    return NextResponse.json({ error: "This payment method is currently unavailable." }, { status: 503 });
  }
  if (parsed.data.method === "CRYPTO" && (!parsed.data.asset || !parsed.data.network || !parsed.data.transactionReference)) {
    return NextResponse.json({ error: "Crypto asset, network, and transaction reference are required for a verification claim." }, { status: 422 });
  }

  try {
    const payment = await createManualPaymentClaim({
      userId: context.userId,
      organizationId: context.activeWorkspace.organizationId,
      invoiceId: parsed.data.invoiceId,
      method: parsed.data.method,
      asset: parsed.data.asset,
      network: parsed.data.network,
      transactionReference: parsed.data.transactionReference,
    });
    return NextResponse.json({
      data: payment,
      message: "Your payment claim has been recorded as pending. This submission does not confirm receipt of funds or activate paid access.",
    }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
