import { NextResponse } from "next/server";
import { z } from "zod";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { canManageBilling } from "@/lib/auth/billing-access";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { enforceRateLimit, PORTAL_INTERACTION_LIMIT } from "@/lib/http/rate-limit";
import { createBankTransferOrder, submitBankTransferClaim, PaymentGatewayError } from "@/lib/services/payment-gateway";
import { paymentFeatureEnabled } from "@/lib/domain/payment-gateway";

const schema = z.object({
  action: z.enum(["INITIATE", "SUBMIT"]),
  invoiceId: z.string().min(1).max(128).optional(),
  paymentId: z.string().min(1).max(128).optional(),
}).strict();

function errorResponse(error: unknown) {
  if (error instanceof PaymentGatewayError) {
    const status = { DISABLED: 503, NOT_FOUND: 404, NOT_PAYABLE: 409, INVALID: 422, CONFLICT: 409, FORBIDDEN: 403, NOT_CONFIGURED: 503 }[error.code];
    return NextResponse.json({ error: error.message, code: error.code }, { status });
  }
  console.error("Bank transfer operation failed.");
  return NextResponse.json({ error: "Bank transfer operation could not be completed." }, { status: 500 });
}

export async function POST(request: Request) {
  if (hasInvalidRequestOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const context = await getWorkspaceContext();
  if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!context.activeWorkspace || !context.principal) return NextResponse.json({ error: "Select an authorized workspace." }, { status: 409 });
  if (!canManageBilling(context.principal.role)) return NextResponse.json({ error: "Billing administrator access required." }, { status: 403 });
  if (process.env.PAYMENTS_ENABLED !== "true" || !paymentFeatureEnabled("BANK_TRANSFER")) {
    return NextResponse.json({ error: "Bank transfer is disabled or has not passed its account-verification gate." }, { status: 503 });
  }
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
  if (!parsed.success) return NextResponse.json({ error: "Invalid bank-transfer request.", issues: parsed.error.flatten().fieldErrors }, { status: 422 });

  try {
    if (parsed.data.action === "INITIATE") {
      if (!parsed.data.invoiceId) return NextResponse.json({ error: "Invoice reference is required." }, { status: 422 });
      const order = await createBankTransferOrder({
        userId: context.userId,
        organizationId: context.activeWorkspace.organizationId,
        invoiceId: parsed.data.invoiceId,
      });
      return NextResponse.json({ data: order }, { status: 201 });
    }
    if (!parsed.data.paymentId) return NextResponse.json({ error: "Payment order reference is required." }, { status: 422 });
    const claim = await submitBankTransferClaim({
      userId: context.userId,
      organizationId: context.activeWorkspace.organizationId,
      paymentId: parsed.data.paymentId,
    });
    return NextResponse.json({
      data: claim,
      message: "The bank-transfer claim is pending independent financial reconciliation. This submission does not mark the invoice paid.",
    }, { status: 200 });
  } catch (error) {
    return errorResponse(error);
  }
}
