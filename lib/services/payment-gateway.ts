import { BillingInvoiceStatus, BillingPaymentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  cryptoRailConfiguration,
  newPaymentReference,
  paymentFeatureEnabled,
  parseTransactionReference,
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
  if (invoice.amountRemainingMinor <= BigInt(0)) throw new PaymentGatewayError("Invoice has no outstanding balance.", "NOT_PAYABLE");
  return invoice.amountRemainingMinor;
}

export async function activateSubscriptionAfterVerifiedPayment(
  tx: Prisma.TransactionClient,
  input: {
    organizationId: string;
    subscriptionId: string | null;
    paymentId: string;
    actorUserId?: string;
    actorRole?: string;
  },
) {
  if (!input.subscriptionId) return { activated: false, reason: "NO_SUBSCRIPTION_LINKED" as const };
  const now = new Date();
  const subscription = await tx.billingSubscription.findFirst({
    where: { id: input.subscriptionId, organizationId: input.organizationId },
    select: { id: true, status: true, currentPeriodStart: true, currentPeriodEnd: true },
  });
  if (!subscription) {
    await tx.platformAuditEvent.create({
      data: {
        actorUserId: input.actorUserId ?? null,
        actorRole: input.actorRole ?? "SYSTEM",
        action: "BILLING_SUBSCRIPTION_REQUIRES_REVIEW",
        subjectType: "BILLING_SUBSCRIPTION",
        subjectId: input.subscriptionId,
        outcome: "SUCCESS",
        reason: "Paid invoice references a subscription that was not found in its organization.",
        details: { organizationId: input.organizationId, paymentId: input.paymentId },
      },
    });
    return { activated: false, reason: "SUBSCRIPTION_NOT_FOUND" as const };
  }
  const eligibleStatus = subscription.status === "ACTIVE" || subscription.status === "TRIALING" || subscription.status === "PAST_DUE";
  const withinPeriod = subscription.currentPeriodStart <= now && subscription.currentPeriodEnd > now;
  if (!eligibleStatus || !withinPeriod) {
    await tx.platformAuditEvent.create({
      data: {
        actorUserId: input.actorUserId ?? null,
        actorRole: input.actorRole ?? "SYSTEM",
        action: "BILLING_SUBSCRIPTION_REQUIRES_REVIEW",
        subjectType: "BILLING_SUBSCRIPTION",
        subjectId: subscription.id,
        outcome: "SUCCESS",
        reason: "Payment was verified, but subscription status or billing period did not permit automatic activation.",
        details: {
          organizationId: input.organizationId, paymentId: input.paymentId,
          priorStatus: subscription.status,
          currentPeriodStart: subscription.currentPeriodStart.toISOString(),
          currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
        },
      },
    });
    return { activated: false, reason: "SUBSCRIPTION_STATE_REQUIRES_REVIEW" as const };
  }
  if (subscription.status !== "ACTIVE") {
    const updated = await tx.billingSubscription.updateMany({
      where: {
        id: subscription.id,
        organizationId: input.organizationId,
        status: subscription.status,
        currentPeriodStart: { lte: now },
        currentPeriodEnd: { gt: now },
      },
      data: { status: "ACTIVE" },
    });
    if (updated.count !== 1) throw new PaymentGatewayError("Subscription changed during payment reconciliation.", "CONFLICT");
  }
  await tx.platformAuditEvent.create({
    data: {
      actorUserId: input.actorUserId ?? null,
      actorRole: input.actorRole ?? "SYSTEM",
      action: subscription.status === "ACTIVE" ? "BILLING_SUBSCRIPTION_PAYMENT_CONFIRMED" : "BILLING_SUBSCRIPTION_ACTIVATED_AFTER_PAYMENT",
      subjectType: "BILLING_SUBSCRIPTION",
      subjectId: subscription.id,
      outcome: "SUCCESS",
      details: { organizationId: input.organizationId, paymentId: input.paymentId },
    },
  });
  return { activated: true, reason: "VERIFIED_PAYMENT_IN_CURRENT_PERIOD" as const };
}

export async function listOpenInvoices(organizationId: string) {
  const invoices = await prisma.billingInvoice.findMany({
    where: { organizationId, status: BillingInvoiceStatus.OPEN, amountRemainingMinor: { gt: BigInt(0) } },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true, invoiceNumber: true, currency: true, amountDueMinor: true,
      amountPaidMinor: true, amountRemainingMinor: true, dueAt: true, createdAt: true,
    },
  });
  return invoices.map((invoice) => ({
    ...invoice,
    amountDueMinor: invoice.amountDueMinor.toString(),
    amountPaidMinor: invoice.amountPaidMinor.toString(),
    amountRemainingMinor: invoice.amountRemainingMinor.toString(),
  }));
}

export async function listPayments(organizationId: string) {
  const payments = await prisma.billingPayment.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true, invoiceId: true, provider: true, providerPaymentId: true,
      status: true, currency: true, amountMinor: true, failureCode: true,
      createdAt: true, paidAt: true,
    },
  });
  return payments.map((payment) => ({
    ...payment,
    amountMinor: payment.amountMinor.toString(),
  }));
}

export async function createBankTransferOrder(input: {
  userId: string;
  organizationId: string;
  invoiceId: string;
}) {
  if (!paymentFeatureEnabled("BANK_TRANSFER")) {
    throw new PaymentGatewayError("Bank transfer is disabled or its institution details are not verified.", "DISABLED");
  }
  const bankInstructions = {
    accountHolder: process.env.BANK_TRANSFER_ACCOUNT_HOLDER!,
    bankName: process.env.BANK_TRANSFER_BANK_NAME!,
    accountType: process.env.BANK_TRANSFER_ACCOUNT_TYPE!,
    accountNumber: process.env.BANK_TRANSFER_ACCOUNT_NUMBER!,
    achRouting: process.env.BANK_TRANSFER_ACH_ROUTING!,
    wireRouting: process.env.BANK_TRANSFER_WIRE_ROUTING!,
    bankAddress: process.env.BANK_TRANSFER_BANK_ADDRESS!,
    currency: "USD",
    supportedSendingRegion: "US",
    achFee: process.env.BANK_TRANSFER_ACH_FEE_USD ?? "",
    wireFee: process.env.BANK_TRANSFER_WIRE_FEE_USD ?? "",
    processingTime: process.env.BANK_TRANSFER_PROCESSING_TIME ?? "1–3 business days (confirm with the financial institution)",
    swiftSupported: false,
  };
  const invoice = await prisma.billingInvoice.findFirst({
    where: { id: input.invoiceId, organizationId: input.organizationId, status: BillingInvoiceStatus.OPEN, currency: "USD", amountRemainingMinor: { gt: BigInt(0) } },
    select: { id: true, invoiceNumber: true, currency: true, amountRemainingMinor: true },
  });
  if (!invoice) throw new PaymentGatewayError("Open USD invoice not found in the active organization.", "NOT_FOUND");
  const paymentReference = newPaymentReference("BANK");
  try {
    const payment = await prisma.$transaction(async (tx) => {
      const pendingPayment = await tx.billingPayment.findFirst({
        where: {
          organizationId: input.organizationId,
          invoiceId: invoice.id,
          status: BillingPaymentStatus.PENDING,
          OR: [{ provider: "bank_transfer" }, { provider: "stripe" }, { provider: { startsWith: "crypto:" } }],
        },
        select: { id: true },
      });
      if (pendingPayment) throw new PaymentGatewayError("Another payment attempt is still pending for this invoice. Complete or reconcile it before creating a new order.", "CONFLICT");
      const fresh = await tx.billingInvoice.findFirst({
        where: { id: invoice.id, organizationId: input.organizationId, status: BillingInvoiceStatus.OPEN },
        select: { amountRemainingMinor: true, currency: true },
      });
      if (!fresh || fresh.currency !== "USD" || fresh.amountRemainingMinor !== invoice.amountRemainingMinor || fresh.amountRemainingMinor <= BigInt(0)) {
        throw new PaymentGatewayError("Invoice changed; refresh and retry.", "CONFLICT");
      }
      const created = await tx.billingPayment.create({
        data: {
          organizationId: input.organizationId,
          invoiceId: invoice.id,
          provider: "bank_transfer",
          providerPaymentId: paymentReference,
          status: BillingPaymentStatus.PENDING,
          currency: invoice.currency,
          amountMinor: invoice.amountRemainingMinor,
        },
        select: { id: true, invoiceId: true, provider: true, providerPaymentId: true, status: true, currency: true, amountMinor: true, createdAt: true },
      });
      await tx.platformAuditEvent.create({
        data: {
          actorUserId: input.userId, actorRole: "CUSTOMER",
          action: "BANK_TRANSFER_ORDER_CREATED", subjectType: "BILLING_PAYMENT",
          subjectId: created.id, outcome: "SUCCESS",
          details: {
            organizationId: input.organizationId, invoiceId: invoice.id,
            paymentReference, amountMinor: invoice.amountRemainingMinor.toString(),
            currency: invoice.currency, submittedByUserId: input.userId,
          },
        },
      });
      return created;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return {
      payment: { ...payment, amountMinor: payment.amountMinor.toString() },
      invoice: { id: invoice.id, invoiceNumber: invoice.invoiceNumber, amountRemainingMinor: invoice.amountRemainingMinor.toString(), currency: invoice.currency },
      instructions: bankInstructions,
    };
  } catch (error) {
    if (error instanceof PaymentGatewayError) throw error;
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new PaymentGatewayError("Could not create a unique bank transfer reference; retry.", "CONFLICT");
    }
    throw error;
  }
}

export async function submitBankTransferClaim(input: {
  userId: string;
  organizationId: string;
  paymentId: string;
}) {
  if (!paymentFeatureEnabled("BANK_TRANSFER")) {
    throw new PaymentGatewayError("Bank transfer is disabled.", "DISABLED");
  }
  return prisma.$transaction(async (tx) => {
    const payment = await tx.billingPayment.findFirst({
      where: { id: input.paymentId, organizationId: input.organizationId, provider: "bank_transfer", status: BillingPaymentStatus.PENDING },
      select: { id: true, invoiceId: true, currency: true, amountMinor: true, providerPaymentId: true, provider: true, status: true },
    });
    if (!payment || !payment.invoiceId || !payment.providerPaymentId) {
      throw new PaymentGatewayError("Pending bank-transfer order not found.", "NOT_FOUND");
    }
    const order = await tx.platformAuditEvent.findFirst({
      where: { action: "BANK_TRANSFER_ORDER_CREATED", subjectType: "BILLING_PAYMENT", subjectId: payment.id, outcome: "SUCCESS" },
      orderBy: { occurredAt: "asc" }, select: { actorUserId: true, details: true },
    });
    if (!order || order.actorUserId !== input.userId) {
      throw new PaymentGatewayError("Only the user who created the transfer instructions may submit its payment claim.", "FORBIDDEN");
    }
    const alreadySubmitted = await tx.platformAuditEvent.findFirst({
      where: { action: "PAYMENT_CLAIM_SUBMITTED", subjectType: "BILLING_PAYMENT", subjectId: payment.id, outcome: "SUCCESS" },
      select: { id: true },
    });
    if (alreadySubmitted) throw new PaymentGatewayError("This transfer has already been submitted for verification.", "CONFLICT");
    const orderDetails = order.details as { paymentReference?: unknown } | null;
    await tx.platformAuditEvent.create({
      data: {
        actorUserId: input.userId, actorRole: "CUSTOMER",
        action: "PAYMENT_CLAIM_SUBMITTED", subjectType: "BILLING_PAYMENT",
        subjectId: payment.id, outcome: "SUCCESS",
        details: {
          organizationId: input.organizationId,
          invoiceId: payment.invoiceId,
          provider: payment.provider,
          paymentReference: payment.providerPaymentId,
          amountMinor: payment.amountMinor.toString(),
          currency: payment.currency,
          claimMetadata: {
            claimType: "BANK_TRANSFER",
            paymentReference: typeof orderDetails?.paymentReference === "string" ? orderDetails.paymentReference : payment.providerPaymentId,
            submittedByUserId: input.userId,
            submittedAt: new Date().toISOString(),
            verificationStatus: "PENDING",
          },
        },
      },
    });
    return { id: payment.id, status: payment.status, paymentReference: payment.providerPaymentId };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function createCryptoPaymentOrder(input: {
  userId: string;
  organizationId: string;
  invoiceId: string;
  asset: "USDT" | "USDC";
  network: "TRON" | "BNB_SMART_CHAIN" | "ETHEREUM" | "SOLANA";
}) {
  if (!paymentFeatureEnabled("CRYPTO")) {
    throw new PaymentGatewayError("Cryptocurrency payments are disabled.", "DISABLED");
  }
  const rail = cryptoRailConfiguration().find((item) =>
    item.asset === input.asset && item.network === input.network && item.enabled,
  );
  if (!rail || !rail.address || !rail.tokenIdentifier || rail.tokenDecimals === null ||
      rail.tokenDecimals < 2 || rail.tokenDecimals > 18) {
    throw new PaymentGatewayError("Selected crypto rail has not passed all configuration gates.", "NOT_CONFIGURED");
  }
  const invoice = await prisma.billingInvoice.findFirst({
    where: { id: input.invoiceId, organizationId: input.organizationId, status: BillingInvoiceStatus.OPEN, currency: "USD", amountRemainingMinor: { gt: BigInt(0) } },
    select: { id: true, invoiceNumber: true, currency: true, amountRemainingMinor: true },
  });
  if (!invoice) throw new PaymentGatewayError("Open USD invoice not found in the active organization.", "NOT_FOUND");
  const paymentReference = newPaymentReference("CRYPTO");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  // Invoice money uses USD cents. Convert cents to base units using the explicitly verified decimals for this exact rail.
  const expectedTokenAmountBaseUnits = (
    invoice.amountRemainingMinor * (BigInt(10) ** BigInt(rail.tokenDecimals - 2))
  ).toString();
  const provider = `crypto:${rail.network.toLowerCase()}:${rail.asset.toLowerCase()}`;

  const result = await prisma.$transaction(async (tx) => {
    const pendingPayment = await tx.billingPayment.findFirst({
      where: {
        organizationId: input.organizationId,
        invoiceId: invoice.id,
        status: BillingPaymentStatus.PENDING,
        OR: [{ provider: "bank_transfer" }, { provider: "stripe" }, { provider: { startsWith: "crypto:" } }],
      },
      select: { id: true },
    });
    if (pendingPayment) throw new PaymentGatewayError("Another payment attempt is still pending for this invoice. Complete or reconcile it before creating a new crypto order.", "CONFLICT");
    const fresh = await tx.billingInvoice.findFirst({
      where: { id: invoice.id, organizationId: input.organizationId, status: BillingInvoiceStatus.OPEN, currency: "USD" },
      select: { amountRemainingMinor: true },
    });
    if (!fresh || fresh.amountRemainingMinor !== invoice.amountRemainingMinor || fresh.amountRemainingMinor <= BigInt(0)) {
      throw new PaymentGatewayError("Invoice balance changed; refresh and create a new order.", "CONFLICT");
    }
    const payment = await tx.billingPayment.create({
      data: {
        organizationId: input.organizationId, invoiceId: invoice.id,
        provider, providerPaymentId: paymentReference,
        status: BillingPaymentStatus.PENDING, currency: "USD",
        amountMinor: invoice.amountRemainingMinor,
      },
      select: { id: true, invoiceId: true, provider: true, providerPaymentId: true, status: true, currency: true, amountMinor: true, createdAt: true },
    });
    await tx.platformAuditEvent.create({
      data: {
        actorUserId: input.userId, actorRole: "CUSTOMER",
        action: "CRYPTO_ORDER_CREATED", subjectType: "BILLING_PAYMENT",
        subjectId: payment.id, outcome: "SUCCESS",
        details: {
          organizationId: input.organizationId, invoiceId: invoice.id,
          paymentReference, amountMinor: invoice.amountRemainingMinor.toString(), currency: "USD",
          submittedByUserId: input.userId,
          orderSnapshot: {
            asset: rail.asset, network: rail.network, destinationAddress: rail.address,
            tokenIdentifier: rail.tokenIdentifier, tokenDecimals: rail.tokenDecimals,
            expectedTokenAmountBaseUnits, quotePolicy: "USD_PARITY_EXPLICITLY_APPROVED",
            createdAt: new Date().toISOString(), expiresAt: expiresAt.toISOString(),
            verificationMode: "MANUAL_FINANCE_RECONCILIATION",
          },
        } as Prisma.InputJsonObject,
      },
    });
    return { ...payment, amountMinor: payment.amountMinor.toString() };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  return {
    payment: result,
    invoice: { id: invoice.id, invoiceNumber: invoice.invoiceNumber, currency: invoice.currency, amountRemainingMinor: invoice.amountRemainingMinor.toString() },
    order: {
      paymentReference, asset: rail.asset, network: rail.network, destinationAddress: rail.address,
      tokenIdentifier: rail.tokenIdentifier, tokenDecimals: rail.tokenDecimals,
      expectedTokenAmountBaseUnits,
      expectedTokenAmount: `${invoice.amountRemainingMinor / BigInt(100)}.${(invoice.amountRemainingMinor % BigInt(100)).toString().padStart(2, "0")}`,
      expiresAt: expiresAt.toISOString(),
    },
  };
}

export async function submitCryptoPaymentClaim(input: {
  userId: string;
  organizationId: string;
  paymentId: string;
  transactionReference: string;
}) {
  if (!paymentFeatureEnabled("CRYPTO")) {
    throw new PaymentGatewayError("Cryptocurrency payments are disabled.", "DISABLED");
  }
  return prisma.$transaction(async (tx) => {
    const payment = await tx.billingPayment.findFirst({
      where: { id: input.paymentId, organizationId: input.organizationId, provider: { startsWith: "crypto:" }, status: BillingPaymentStatus.PENDING },
      select: { id: true, invoiceId: true, provider: true, providerPaymentId: true, currency: true, amountMinor: true },
    });
    if (!payment || !payment.invoiceId || !payment.provider || !payment.providerPaymentId) {
      throw new PaymentGatewayError("Pending cryptocurrency payment order not found.", "NOT_FOUND");
    }
    const orderEvent = await tx.platformAuditEvent.findFirst({
      where: { action: "CRYPTO_ORDER_CREATED", subjectType: "BILLING_PAYMENT", subjectId: payment.id, outcome: "SUCCESS" },
      orderBy: { occurredAt: "asc" }, select: { actorUserId: true, details: true },
    });
    if (!orderEvent || orderEvent.actorUserId !== input.userId) {
      throw new PaymentGatewayError("Only the user who created this crypto order may submit its transaction claim.", "FORBIDDEN");
    }
    const orderDetails = orderEvent.details as {
      organizationId?: unknown;
      paymentReference?: unknown;
      amountMinor?: unknown;
      currency?: unknown;
      orderSnapshot?: {
        asset?: unknown; network?: unknown; destinationAddress?: unknown; tokenIdentifier?: unknown;
        tokenDecimals?: unknown; expectedTokenAmountBaseUnits?: unknown; expiresAt?: unknown;
        quotePolicy?: unknown; verificationMode?: unknown;
      };
    } | null;
    if (orderDetails?.organizationId !== input.organizationId || typeof orderDetails.paymentReference !== "string" ||
        typeof orderDetails.amountMinor !== "string" || orderDetails.amountMinor !== payment.amountMinor.toString()) {
      throw new PaymentGatewayError("Payment order integrity check failed.", "CONFLICT");
    }
    const snapshot = orderDetails.orderSnapshot;
    if (!snapshot || typeof snapshot.network !== "string" || typeof snapshot.asset !== "string" ||
        typeof snapshot.expectedTokenAmountBaseUnits !== "string" || typeof snapshot.expiresAt !== "string") {
      throw new PaymentGatewayError("Payment order snapshot is incomplete.", "CONFLICT");
    }
    const networkPrefix = `crypto:${String(snapshot.network).toLowerCase()}:`;
    if (!payment.provider.startsWith(networkPrefix) || payment.currency !== "USD" ||
        !parseTransactionReference(input.transactionReference, String(snapshot.network))) {
      throw new PaymentGatewayError("Payment order network or currency does not match its snapshot.", "CONFLICT");
    }
    const transactionAlreadyClaimed = await tx.billingPayment.findFirst({
      where: {
        organizationId: input.organizationId,
        provider: { startsWith: networkPrefix },
        providerPaymentId: input.transactionReference,
      },
      select: { id: true },
    });
    if (transactionAlreadyClaimed) {
      throw new PaymentGatewayError("This transaction has already been associated with a payment order on this network.", "CONFLICT");
    }
    const expiry = new Date(snapshot.expiresAt);
    if (Number.isNaN(expiry.getTime())) throw new PaymentGatewayError("Payment order expiry is invalid.", "CONFLICT");
    const latePayment = Date.now() > expiry.getTime();

    const updated = await tx.billingPayment.updateMany({
      where: { id: payment.id, organizationId: input.organizationId, status: BillingPaymentStatus.PENDING, providerPaymentId: orderDetails.paymentReference },
      data: { providerPaymentId: input.transactionReference },
    });
    if (updated.count !== 1) throw new PaymentGatewayError("Payment order was already submitted or changed.", "CONFLICT");
    await tx.platformAuditEvent.create({
      data: {
        actorUserId: input.userId, actorRole: "CUSTOMER",
        action: "PAYMENT_CLAIM_SUBMITTED", subjectType: "BILLING_PAYMENT",
        subjectId: payment.id, outcome: "SUCCESS",
        details: {
          organizationId: input.organizationId, invoiceId: payment.invoiceId,
          provider: payment.provider, paymentReference: orderDetails.paymentReference,
          amountMinor: payment.amountMinor.toString(), currency: payment.currency,
          claimMetadata: {
            claimType: "CRYPTO", paymentReference: orderDetails.paymentReference,
            submittedByUserId: input.userId, submittedAt: new Date().toISOString(),
            verificationStatus: "PENDING", network: snapshot.network, asset: snapshot.asset,
            destinationAddress: snapshot.destinationAddress, tokenIdentifier: snapshot.tokenIdentifier,
            tokenDecimals: snapshot.tokenDecimals,
            expectedTokenAmountBaseUnits: snapshot.expectedTokenAmountBaseUnits,
            transactionReference: input.transactionReference, expiresAt: snapshot.expiresAt,
            latePayment, quotePolicy: snapshot.quotePolicy,
            verificationMode: "MANUAL_FINANCE_RECONCILIATION",
          },
        } as Prisma.InputJsonObject,
      },
    });
    return { id: payment.id, status: BillingPaymentStatus.PENDING, paymentReference: orderDetails.paymentReference, latePayment };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
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
      input.bankTransactionReference.trim().length < 4 || input.receivedAmountMinor <= BigInt(0) ||
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
    if (input.decision === "APPROVE") {
      const duplicateBankReference = await tx.billingPayment.findFirst({
        where: {
          provider: "bank_transfer",
          providerPaymentId: `bank-transfer:${input.bankTransactionReference.trim()}`,
          id: { not: payment.id },
        },
        select: { id: true },
      });
      if (duplicateBankReference) {
        throw new PaymentGatewayError("This bank transaction reference has already been reconciled against another payment.", "CONFLICT");
      }
    }
    const invoice = await tx.billingInvoice.findFirst({
      where: { id: payment.invoiceId, organizationId: input.organizationId, status: BillingInvoiceStatus.OPEN },
      select: { id: true, amountRemainingMinor: true, currency: true, amountPaidMinor: true, subscriptionId: true },
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
      await activateSubscriptionAfterVerifiedPayment(tx, {
        organizationId: input.organizationId, subscriptionId: invoice.subscriptionId,
        paymentId: payment.id, actorUserId: input.actorUserId, actorRole: "FINANCE_REVIEWER",
      });
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

export async function reconcileCryptoPayment(input: {
  actorUserId: string;
  organizationId: string;
  paymentId: string;
  receivedAmountBaseUnits: bigint;
  evidenceReference: string;
  reason: string;
  decision: "APPROVE" | "REJECT";
}) {
  if (process.env.PAYMENTS_ENABLED !== "true" ||
      process.env.CRYPTO_PAYMENTS_ENABLED !== "true" ||
      process.env.CRYPTO_MANUAL_RECONCILIATION_ENABLED !== "true") {
    throw new PaymentGatewayError("Crypto reconciliation is disabled.", "DISABLED");
  }
  if (input.reason.trim().length < 8 || input.evidenceReference.trim().length < 8 ||
      (input.decision === "APPROVE" && input.receivedAmountBaseUnits <= BigInt(0))) {
    throw new PaymentGatewayError("Independent chain evidence, exact received base units, and a reason are required.", "INVALID");
  }
  try {
    const evidenceUrl = new URL(input.evidenceReference);
    if (evidenceUrl.protocol !== "https:") throw new Error("HTTPS required");
  } catch {
    throw new PaymentGatewayError("Crypto evidence must be a valid HTTPS blockchain-explorer or evidence URL.", "INVALID");
  }
  return prisma.$transaction(async (tx) => {
    const originalClaim = await tx.platformAuditEvent.findFirst({
      where: { action: "PAYMENT_CLAIM_SUBMITTED", subjectType: "BILLING_PAYMENT", subjectId: input.paymentId, outcome: "SUCCESS" },
      orderBy: { occurredAt: "asc" },
      select: { actorUserId: true, details: true },
    });
    if (!originalClaim || originalClaim.actorUserId === input.actorUserId) {
      throw new PaymentGatewayError("The submitter cannot reconcile their own crypto claim.", "FORBIDDEN");
    }
    const claimDetails = originalClaim.details as { organizationId?: unknown; claimMetadata?: unknown } | null;
    if (claimDetails?.organizationId !== input.organizationId) {
      throw new PaymentGatewayError("Claim organization does not match the review scope.", "FORBIDDEN");
    }
    const claimMetadata = claimDetails?.claimMetadata as {
      expectedTokenAmountBaseUnits?: unknown;
      transactionReference?: unknown;
      tokenIdentifier?: unknown;
      network?: unknown;
      asset?: unknown;
      submittedByUserId?: unknown;
      destinationAddress?: unknown;
      tokenDecimals?: unknown;
      expiresAt?: unknown;
      quotePolicy?: unknown;
    } | undefined;
    const payment = await tx.billingPayment.findFirst({
      where: { id: input.paymentId, organizationId: input.organizationId, provider: { startsWith: "crypto:" } },
      select: { id: true, invoiceId: true, status: true, amountMinor: true, currency: true, providerPaymentId: true, provider: true },
    });
    if (!payment || !payment.invoiceId) throw new PaymentGatewayError("Crypto payment claim not found.", "NOT_FOUND");
    if (payment.status !== BillingPaymentStatus.PENDING) throw new PaymentGatewayError("Crypto claim is no longer pending.", "CONFLICT");
    if (payment.providerPaymentId !== claimMetadata?.transactionReference) {
      throw new PaymentGatewayError("Transaction reference does not match the immutable claim.", "INVALID");
    }
    if (input.decision === "REJECT") {
      const changed = await tx.billingPayment.updateMany({
        where: { id: payment.id, organizationId: input.organizationId, status: BillingPaymentStatus.PENDING },
        data: { status: BillingPaymentStatus.FAILED, failureCode: "CRYPTO_CLAIM_REJECTED", failureMessage: input.reason.trim() },
      });
      if (changed.count !== 1) throw new PaymentGatewayError("Crypto claim has already been reviewed.", "CONFLICT");
      await tx.platformAuditEvent.create({
        data: {
          actorUserId: input.actorUserId, actorRole: "SUPER_ADMIN",
          action: "CRYPTO_PAYMENT_REJECTED", subjectType: "BILLING_PAYMENT", subjectId: payment.id,
          outcome: "SUCCESS", reason: input.reason.trim(),
          details: { organizationId: input.organizationId, evidenceReference: input.evidenceReference.trim(), transactionReference: payment.providerPaymentId, automaticVerification: false },
        },
      });
      return { id: payment.id, status: BillingPaymentStatus.FAILED };
    }
    const activeRail = cryptoRailConfiguration().find((rail) =>
      rail.enabled && rail.asset === claimMetadata?.asset && rail.network === claimMetadata?.network,
    );
    if (!activeRail ||
        activeRail.address !== claimMetadata?.destinationAddress ||
        activeRail.tokenIdentifier !== claimMetadata?.tokenIdentifier ||
        activeRail.tokenDecimals !== claimMetadata?.tokenDecimals) {
      throw new PaymentGatewayError("The payment rail configuration has changed or is disabled; escalate the claim for controlled review.", "NOT_CONFIGURED");
    }
    if (payment.currency !== "USD" || typeof claimMetadata?.expectedTokenAmountBaseUnits !== "string" ||
        BigInt(claimMetadata.expectedTokenAmountBaseUnits) !== input.receivedAmountBaseUnits) {
      throw new PaymentGatewayError("Received token amount does not match the immutable claim.", "INVALID");
    }
    const invoice = await tx.billingInvoice.findFirst({
      where: { id: payment.invoiceId, organizationId: input.organizationId, status: BillingInvoiceStatus.OPEN },
      select: { id: true, amountRemainingMinor: true, currency: true, subscriptionId: true },
    });
    if (!invoice || invoice.currency !== "USD" || invoice.amountRemainingMinor !== payment.amountMinor) {
      throw new PaymentGatewayError("Invoice balance changed; crypto claim requires review.", "CONFLICT");
    }
    const updatedPayment = await tx.billingPayment.updateMany({
      where: { id: payment.id, organizationId: input.organizationId, status: BillingPaymentStatus.PENDING },
      data: { status: BillingPaymentStatus.SUCCEEDED, paidAt: new Date() },
    });
    if (updatedPayment.count !== 1) throw new PaymentGatewayError("Crypto claim has already been reviewed.", "CONFLICT");
    const updatedInvoice = await tx.billingInvoice.updateMany({
      where: { id: invoice.id, organizationId: input.organizationId, status: BillingInvoiceStatus.OPEN, amountRemainingMinor: payment.amountMinor },
      data: {
        amountPaidMinor: { increment: payment.amountMinor },
        amountRemainingMinor: { decrement: payment.amountMinor },
        status: BillingInvoiceStatus.PAID,
        paidAt: new Date(),
      },
    });
    if (updatedInvoice.count !== 1) throw new PaymentGatewayError("Invoice changed during reconciliation; transaction rolled back.", "CONFLICT");
    await activateSubscriptionAfterVerifiedPayment(tx, {
      organizationId: input.organizationId, subscriptionId: invoice.subscriptionId,
      paymentId: payment.id, actorUserId: input.actorUserId, actorRole: "SUPER_ADMIN",
    });
    await tx.platformAuditEvent.create({
      data: {
        actorUserId: input.actorUserId,
        actorRole: "SUPER_ADMIN",
        action: "CRYPTO_PAYMENT_RECONCILED",
        subjectType: "BILLING_PAYMENT",
        subjectId: payment.id,
        outcome: "SUCCESS",
        reason: input.reason.trim(),
        details: {
          organizationId: input.organizationId,
          invoiceId: invoice.id,
          provider: payment.provider,
          asset: typeof claimMetadata.asset === "string" ? claimMetadata.asset : null,
          network: typeof claimMetadata.network === "string" ? claimMetadata.network : null,
          tokenIdentifier: typeof claimMetadata.tokenIdentifier === "string" ? claimMetadata.tokenIdentifier : null,
          transactionReference: payment.providerPaymentId,
          receivedAmountBaseUnits: input.receivedAmountBaseUnits.toString(),
          evidenceReference: input.evidenceReference.trim(),
          submittedByUserId: typeof claimMetadata.submittedByUserId === "string" ? claimMetadata.submittedByUserId : null,
          automaticVerification: false,
        } as Prisma.InputJsonObject,
      },
    });
    return { id: payment.id, status: BillingPaymentStatus.SUCCEEDED };
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
