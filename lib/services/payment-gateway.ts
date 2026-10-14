import { BillingInvoiceStatus, BillingPaymentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  cryptoRailConfiguration,
  newPaymentReference,
  paymentFeatureEnabled,
  type PaymentMethod,
} from "@/lib/domain/payment-gateway";

export class PaymentGatewayError extends Error {
  constructor(
    message: string,
    public readonly code: "DISABLED" | "NOT_FOUND" | "NOT_PAYABLE" | "INVALID" | "CONFLICT" | "FORBIDDEN" | "NOT_CONFIGURED",
  ) {
    super(message);
    this.name = "PaymentGatewayError";
  }
}

function safeInvoiceAmount(invoice: { amountDueMinor: bigint; amountPaidMinor: bigint; amountRemainingMinor: bigint }) {
  if (invoice.amountRemainingMinor <= 0n) throw new PaymentGatewayError("Invoice has no outstanding balance.", "NOT_PAYABLE");
  return invoice.amountRemainingMinor;
}

export async function listOpenInvoices(organizationId: string) {
  return prisma.billingInvoice.findMany({
    where: { organizationId, status: BillingInvoiceStatus.OPEN, amountRemainingMinor: { gt: 0n } },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true, invoiceNumber: true, currency: true, amountDueMinor: true,
      amountPaidMinor: true, amountRemainingMinor: true, dueAt: true, createdAt: true,
    },
  });
}

export async function listPayments(organizationId: string) {
  return prisma.billingPayment.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true, invoiceId: true, provider: true, providerPaymentId: true,
      status: true, currency: true, amountMinor: true, failureCode: true,
      createdAt: true, paidAt: true,
    },
  });
}

export async function createManualPaymentClaim(input: {
  userId: string;
  organizationId: string;
  invoiceId: string;
  method: "BANK_TRANSFER" | "CRYPTO";
  network?: string;
  asset?: string;
  transactionReference?: string;
}) {
  const method: PaymentMethod = input.method;
  if (!paymentFeatureEnabled(method)) {
    throw new PaymentGatewayError("This payment method is not enabled for this deployment.", "DISABLED");
  }

  const invoice = await prisma.billingInvoice.findFirst({
    where: {
      id: input.invoiceId,
      organizationId: input.organizationId,
      status: BillingInvoiceStatus.OPEN,
    },
    select: {
      id: true, organizationId: true, currency: true, amountDueMinor: true,
      amountPaidMinor: true, amountRemainingMinor: true,
    },
  });
  if (!invoice) throw new PaymentGatewayError("Open invoice not found in the active organization.", "NOT_FOUND");
  const amountMinor = safeInvoiceAmount(invoice);
  if (!/^[A-Z]{3}$/.test(invoice.currency)) {
    throw new PaymentGatewayError("Invoice currency is not configured correctly.", "INVALID");
  }

  let provider = "bank_transfer";
  let paymentReference = newPaymentReference("BANK");
  let providerPaymentId = paymentReference;
  let metadata: Prisma.InputJsonObject = {
    claimType: "BANK_TRANSFER",
    paymentReference,
    submittedByUserId: input.userId,
    submittedAt: new Date().toISOString(),
    verificationStatus: "PENDING",
  };

  if (method === "CRYPTO") {
    const rail = cryptoRailConfiguration().find((r) => r.network === input.network && r.asset === input.asset && r.enabled);
    if (!rail || !rail.address || !rail.tokenIdentifier) {
      throw new PaymentGatewayError("Selected crypto rail has not passed its configuration gates.", "NOT_CONFIGURED");
    }
    if (!input.transactionReference) {
      throw new PaymentGatewayError("A transaction reference is required.", "INVALID");
    }
    provider = `crypto:${rail.network.toLowerCase()}:${rail.asset.toLowerCase()}`;
    paymentReference = newPaymentReference("CRYPTO");
    providerPaymentId = input.transactionReference;
    metadata = {
      claimType: "CRYPTO",
      paymentReference,
      submittedByUserId: input.userId,
      submittedAt: new Date().toISOString(),
      verificationStatus: "PENDING",
      network: rail.network,
      asset: rail.asset,
      destinationAddress: rail.address,
      tokenIdentifier: rail.tokenIdentifier,
      transactionReference: input.transactionReference,
      verificationMode: "MANUAL_REVIEW_REQUIRED",
    };
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const currentInvoice = await tx.billingInvoice.findFirst({
        where: { id: invoice.id, organizationId: invoice.organizationId, status: BillingInvoiceStatus.OPEN },
        select: { id: true, currency: true, amountRemainingMinor: true },
      });
      if (!currentInvoice || currentInvoice.amountRemainingMinor <= 0n || currentInvoice.amountRemainingMinor !== amountMinor) {
        throw new PaymentGatewayError("Invoice changed; refresh and try again.", "CONFLICT");
      }

      const existing = await tx.billingPayment.findFirst({
        where: {
          organizationId: input.organizationId,
          invoiceId: invoice.id,
          provider,
          status: BillingPaymentStatus.PENDING,
        },
        select: { id: true },
      });
      if (existing) throw new PaymentGatewayError("A pending claim already exists for this payment method and invoice.", "CONFLICT");

      const payment = await tx.billingPayment.create({
        data: {
          organizationId: input.organizationId,
          invoiceId: invoice.id,
          provider,
          providerPaymentId,
          status: BillingPaymentStatus.PENDING,
          currency: invoice.currency,
          amountMinor,
        },
        select: { id: true, invoiceId: true, provider: true, providerPaymentId: true, status: true, currency: true, amountMinor: true, createdAt: true },
      });

      // Existing BillingPayment has no JSON metadata column. Store claim details in the
      // payload-hash-only webhook model is inappropriate, so persist audit-safe details
      // in a distinct platform audit event only after validating organization ownership.
      await tx.platformAuditEvent.create({
        data: {
          actorUserId: input.userId,
          actorRole: "CUSTOMER",
          action: "PAYMENT_CLAIM_SUBMITTED",
          subjectType: "BILLING_PAYMENT",
          subjectId: payment.id,
          outcome: "SUCCESS",
          details: {
            organizationId: input.organizationId,
            invoiceId: invoice.id,
            provider,
            paymentReference,
            amountMinor: amountMinor.toString(),
            currency: invoice.currency,
            claimMetadata: metadata,
          } as Prisma.InputJsonObject,
        },
      });
      return payment;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof PaymentGatewayError) throw error;
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new PaymentGatewayError("Duplicate payment claim was prevented.", "CONFLICT");
    }
    throw error;
  }
}

export async function reconcileBankTransfer(input: {
  actorUserId: string;
  organizationId: string;
  paymentId: string;
  receivedAmountMinor: bigint;
  receivedCurrency: string;
  bankTransactionReference: string;
  evidenceReference: string;
  decision: "APPROVE" | "REJECT";
  reason: string;
}) {
  if (!paymentFeatureEnabled("BANK_TRANSFER")) {
    throw new PaymentGatewayError("Bank transfer reconciliation is disabled.", "DISABLED");
  }
  if (input.reason.trim().length < 8 || input.evidenceReference.trim().length < 4 ||
      input.bankTransactionReference.trim().length < 4 || input.receivedAmountMinor <= 0n ||
      !/^[A-Z]{3}$/.test(input.receivedCurrency)) {
    throw new PaymentGatewayError("Complete valid reconciliation evidence is required.", "INVALID");
  }
  return prisma.$transaction(async (tx) => {
    const originalClaim = await tx.platformAuditEvent.findFirst({
      where: { action: "PAYMENT_CLAIM_SUBMITTED", subjectType: "BILLING_PAYMENT", subjectId: input.paymentId, outcome: "SUCCESS" },
      orderBy: { occurredAt: "asc" },
      select: { actorUserId: true },
    });
    if (!originalClaim || originalClaim.actorUserId === input.actorUserId) {
      throw new PaymentGatewayError("The submitter cannot reconcile their own claim; an independent reviewer is required.", "FORBIDDEN");
    }
    const payment = await tx.billingPayment.findFirst({
      where: { id: input.paymentId, organizationId: input.organizationId, provider: "bank_transfer" },
      select: { id: true, invoiceId: true, status: true, amountMinor: true, currency: true },
    });
    if (!payment || !payment.invoiceId) throw new PaymentGatewayError("Bank-transfer claim not found.", "NOT_FOUND");
    if (payment.status !== BillingPaymentStatus.PENDING) throw new PaymentGatewayError("Payment is no longer pending.", "CONFLICT");
    if (input.decision === "APPROVE" &&
        (input.receivedAmountMinor !== payment.amountMinor || input.receivedCurrency !== payment.currency)) {
      throw new PaymentGatewayError("Received amount or currency does not exactly match the claim; escalate for manual review.", "INVALID");
    }
    const invoice = await tx.billingInvoice.findFirst({
      where: { id: payment.invoiceId, organizationId: input.organizationId, status: BillingInvoiceStatus.OPEN },
      select: { id: true, amountRemainingMinor: true, currency: true, amountPaidMinor: true },
    });
    if (!invoice) throw new PaymentGatewayError("Open invoice not found.", "NOT_PAYABLE");
    if (input.decision === "APPROVE" && (invoice.currency !== input.receivedCurrency || invoice.amountRemainingMinor !== payment.amountMinor)) {
      throw new PaymentGatewayError("Invoice balance changed; reconciliation requires review.", "CONFLICT");
    }
    const resultStatus = input.decision === "APPROVE" ? BillingPaymentStatus.SUCCEEDED : BillingPaymentStatus.FAILED;
    const updated = await tx.billingPayment.updateMany({
      where: { id: payment.id, organizationId: input.organizationId, status: BillingPaymentStatus.PENDING },
      data: {
        status: resultStatus,
        ...(input.decision === "APPROVE" ? { providerPaymentId: `bank-transfer:${input.bankTransactionReference.trim()}` } : {}),
        paidAt: input.decision === "APPROVE" ? new Date() : null,
        failureCode: input.decision === "REJECT" ? "BANK_TRANSFER_REJECTED" : null,
        failureMessage: input.decision === "REJECT" ? input.reason.trim() : null,
      },
    });
    if (updated.count !== 1) throw new PaymentGatewayError("Claim has already been reconciled.", "CONFLICT");
    if (input.decision === "APPROVE") {
      const changed = await tx.billingInvoice.updateMany({
        where: { id: invoice.id, organizationId: input.organizationId, status: BillingInvoiceStatus.OPEN, amountRemainingMinor: payment.amountMinor },
        data: {
          amountPaidMinor: { increment: payment.amountMinor },
          amountRemainingMinor: { decrement: payment.amountMinor },
          status: BillingInvoiceStatus.PAID,
          paidAt: new Date(),
        },
      });
      if (changed.count !== 1) throw new PaymentGatewayError("Invoice was modified concurrently; reconciliation rolled back.", "CONFLICT");
    }
    await tx.platformAuditEvent.create({
      data: {
        actorUserId: input.actorUserId,
        actorRole: "FINANCE_REVIEWER",
        action: input.decision === "APPROVE" ? "BANK_TRANSFER_RECONCILED" : "BANK_TRANSFER_REJECTED",
        subjectType: "BILLING_PAYMENT",
        subjectId: payment.id,
        outcome: "SUCCESS",
        reason: input.reason.trim(),
        details: {
          organizationId: input.organizationId,
          invoiceId: invoice.id,
          receivedAmountMinor: input.receivedAmountMinor.toString(),
          receivedCurrency: input.receivedCurrency,
          bankTransactionReference: input.bankTransactionReference.trim(),
          evidenceReference: input.evidenceReference.trim(),
          decision: input.decision,
        } as Prisma.InputJsonObject,
      },
    });
    return { id: payment.id, status: resultStatus };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function recordCryptoClaimAudit(input: {
  actorUserId: string; organizationId: string; paymentId: string; reason: string;
}) {
  await prisma.platformAuditEvent.create({
    data: {
      actorUserId: input.actorUserId,
      actorRole: "SYSTEM",
      action: "CRYPTO_PAYMENT_NEEDS_VERIFICATION",
      subjectType: "BILLING_PAYMENT",
      subjectId: input.paymentId,
      outcome: "SUCCESS",
      reason: input.reason,
      details: { organizationId: input.organizationId, verification: "NOT_AUTOMATED" },
    },
  });
}
