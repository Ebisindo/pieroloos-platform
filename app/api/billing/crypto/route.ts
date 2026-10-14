import { NextResponse } from "next/server";
import { z } from "zod";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { canManageBilling } from "@/lib/auth/billing-access";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { enforceRateLimit, PORTAL_INTERACTION_LIMIT } from "@/lib/http/rate-limit";
import { createCryptoPaymentOrder, submitCryptoPaymentClaim, PaymentGatewayError } from "@/lib/services/payment-gateway";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("INITIATE"),
    invoiceId: z.string().min(1).max(128),
    asset: z.enum(["USDT", "USDC"]),
    network: z.enum(["TRON", "BNB_SMART_CHAIN", "ETHEREUM", "SOLANA"]),
  }).strict(),
  z.object({
    action: z.literal("SUBMIT"),
    paymentId: z.string().min(1).max(128),
    transactionReference: z.string().trim().min(32).max(160),
  }).strict(),
]);

function errorResponse(error: unknown) {
  if (error instanceof PaymentGatewayError) {
    const status = { DISABLED: 503, NOT_FOUND: 404, NOT_PAYABLE: 409, INVALID: 422, CONFLICT: 409, FORBIDDEN: 403, NOT_CONFIGURED: 503 }[error.code];
    return NextResponse.json({ error: error.message, code: error.code }, { status });
  }
  console.error("Crypto payment operation failed.");
  return NextResponse.json({ error: "Cryptocurrency payment operation could not be completed." }, { status: 500 });
}

export async function POST(request: Request) {
  if (hasInvalidRequestOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const context = await getWorkspaceContext();
  if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!context.activeWorkspace || !context.principal) return NextResponse.json({ error: "Select an authorized workspace." }, { status: 409 });
  if (!canManageBilling(context.principal.role)) return NextResponse.json({ error: "Billing administrator access required." }, { status: 403 });
  const limited = await enforceRateLimit(PORTAL_INTERACTION_LIMIT, context.userId);
  if (limited) return limited;

  let body: unknown;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > 8 * 1024) return NextResponse.json({ error: "Request body is too large." }, { status: 413 });
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid crypto payment request.", issues: parsed.error.flatten().fieldErrors }, { status: 422 });

  try {
    if (parsed.data.action === "INITIATE") {
      const order = await createCryptoPaymentOrder({
        userId: context.userId,
        organizationId: context.activeWorkspace.organizationId,
        invoiceId: parsed.data.invoiceId,
        asset: parsed.data.asset,
        network: parsed.data.network,
      });
      return NextResponse.json({ data: order }, { status: 201 });
    }
    const claim = await submitCryptoPaymentClaim({
      userId: context.userId,
      organizationId: context.activeWorkspace.organizationId,
      paymentId: parsed.data.paymentId,
      transactionReference: parsed.data.transactionReference,
    });
    return NextResponse.json({
      data: claim,
      message: "Transaction claim recorded as pending manual verification. Submitting a transaction hash does not confirm payment or activate paid access.",
    }, { status: 200 });
  } catch (error) {
    return errorResponse(error);
  }
}
