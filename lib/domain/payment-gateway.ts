import { createHash, randomUUID } from "node:crypto";

export const PAYMENT_METHODS = ["STRIPE", "BANK_TRANSFER", "CRYPTO"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const PAYMENT_STATUSES = [
  "CREATED", "AWAITING_PAYMENT", "PENDING_VERIFICATION", "PROCESSING",
  "PAID", "FAILED", "EXPIRED", "REJECTED", "REFUNDED", "DISPUTED", "REQUIRES_REVIEW",
] as const;
export type PaymentWorkflowStatus = (typeof PAYMENT_STATUSES)[number];

export const CRYPTO_RAILS = [
  { asset: "USDT", network: "TRON", envKey: "CRYPTO_USDT_TRON_ADDRESS" },
  { asset: "USDT", network: "BNB_SMART_CHAIN", envKey: "CRYPTO_USDT_BSC_ADDRESS" },
  { asset: "USDC", network: "ETHEREUM", envKey: "CRYPTO_USDC_ETHEREUM_ADDRESS" },
  { asset: "USDC", network: "SOLANA", envKey: "CRYPTO_USDC_SOLANA_ADDRESS" },
  { asset: "USDC", network: "BNB_SMART_CHAIN", envKey: "CRYPTO_USDC_BSC_ADDRESS" },
] as const;

export function paymentFeatureEnabled(method: PaymentMethod, env: NodeJS.ProcessEnv = process.env) {
  if (env.PAYMENTS_ENABLED !== "true") return false;
  if (method === "STRIPE") return env.STRIPE_PAYMENTS_ENABLED === "true" &&
    Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET);
  if (method === "BANK_TRANSFER") return env.BANK_TRANSFER_ENABLED === "true" &&
    env.BANK_TRANSFER_DETAILS_VERIFIED === "true" &&
    Boolean(
      env.BANK_TRANSFER_ACCOUNT_HOLDER?.trim() &&
      env.BANK_TRANSFER_BANK_NAME?.trim() &&
      env.BANK_TRANSFER_ACCOUNT_NUMBER?.trim() &&
      env.BANK_TRANSFER_ACH_ROUTING?.trim() &&
      env.BANK_TRANSFER_WIRE_ROUTING?.trim() &&
      env.BANK_TRANSFER_BANK_ADDRESS?.trim() &&
      env.BANK_TRANSFER_ACCOUNT_TYPE?.trim() &&
      env.BANK_TRANSFER_CURRENCY === "USD" &&
      env.BANK_TRANSFER_SUPPORTED_SENDING_REGION === "US"
    );
  return env.CRYPTO_PAYMENTS_ENABLED === "true";
}

export function cryptoRailConfiguration(env: NodeJS.ProcessEnv = process.env) {
  return CRYPTO_RAILS.map((rail) => {
    const address = env[rail.envKey]?.trim() ?? "";
    // Destination addresses alone are not enough: token identity, verification provider,
    // and independent address-control verification are required before a rail is offered.
    const tokenIdentifierEnv = rail.network === "SOLANA"
      ? "CRYPTO_USDC_SOLANA_MINT"
      : `CRYPTO_${rail.asset}_${rail.network}_TOKEN_ID`;
    const tokenIdentifier = env[tokenIdentifierEnv]?.trim() ?? "";
    const configuredDecimals = env[`CRYPTO_${rail.asset}_${rail.network}_TOKEN_DECIMALS`];
    const tokenDecimals = configuredDecimals && /^\d+$/.test(configuredDecimals) ? Number(configuredDecimals) : null;
    const destinationVerified = env[`${rail.envKey}_VERIFIED`] === "true";
    const tokenVerified = env[`${tokenIdentifierEnv}_VERIFIED`] === "true";
    const networkEnabled = env[`CRYPTO_${rail.network}_ENABLED`] === "true";
    // This implementation supports only an explicitly approved USD-parity quote and
    // human finance review against independent chain evidence. It does not claim automatic
    // on-chain verification. Stablecoin decimals must be explicitly configured as verified.
    const reviewPolicyReady = env.CRYPTO_MANUAL_RECONCILIATION_ENABLED === "true" &&
      env.CRYPTO_USD_PARITY_QUOTE_APPROVED === "true" &&
      env.CRYPTO_TOKEN_DECIMALS_VERIFIED === "true" &&
      tokenDecimals === 6;
    return {
      asset: rail.asset,
      network: rail.network,
      address,
      tokenIdentifier,
      tokenDecimals,
      enabled: env.PAYMENTS_ENABLED === "true" &&
        env.CRYPTO_PAYMENTS_ENABLED === "true" &&
        networkEnabled &&
        Boolean(address && tokenIdentifier) &&
        destinationVerified && tokenVerified && reviewPolicyReady,
    };
  });
}

export function newPaymentReference(prefix = "PLO") {
  return `${prefix}-${randomUUID().replaceAll("-", "").slice(0, 20).toUpperCase()}`;
}

export function hashWebhookPayload(rawBody: string) {
  return createHash("sha256").update(rawBody, "utf8").digest("hex");
}

export function validatePositiveMinorAmount(value: unknown): value is bigint {
  return typeof value === "bigint" && value > 0n;
}

export function allowedPaymentTransition(from: PaymentWorkflowStatus, to: PaymentWorkflowStatus) {
  if (from === to) return true;
  const transitions: Record<PaymentWorkflowStatus, readonly PaymentWorkflowStatus[]> = {
    CREATED: ["AWAITING_PAYMENT", "PENDING_VERIFICATION", "FAILED", "EXPIRED", "REQUIRES_REVIEW"],
    AWAITING_PAYMENT: ["PENDING_VERIFICATION", "PROCESSING", "PAID", "FAILED", "EXPIRED", "REQUIRES_REVIEW"],
    PENDING_VERIFICATION: ["PROCESSING", "PAID", "FAILED", "EXPIRED", "REJECTED", "REQUIRES_REVIEW"],
    PROCESSING: ["PENDING_VERIFICATION", "PAID", "FAILED", "REQUIRES_REVIEW"],
    PAID: ["REFUNDED", "DISPUTED", "REQUIRES_REVIEW"],
    FAILED: ["PENDING_VERIFICATION", "REQUIRES_REVIEW"],
    EXPIRED: ["PENDING_VERIFICATION", "REQUIRES_REVIEW"],
    REJECTED: ["PENDING_VERIFICATION", "REQUIRES_REVIEW"],
    REFUNDED: ["REQUIRES_REVIEW"],
    DISPUTED: ["PAID", "REFUNDED", "REQUIRES_REVIEW"],
    REQUIRES_REVIEW: ["PENDING_VERIFICATION", "PAID", "FAILED", "REJECTED", "REFUNDED", "DISPUTED"],
  };
  return transitions[from].includes(to);
}

export function parseTransactionReference(value: unknown, network: string): string | null {
  if (typeof value !== "string") return null;
  const candidate = value.trim();
  if (!candidate || candidate.length > 160) return null;
  // Conservative syntactic validation only. Successful format validation is NOT payment proof.
  const patterns: Record<string, RegExp> = {
    TRON: /^[0-9a-fA-F]{64}$/,
    BNB_SMART_CHAIN: /^0x[0-9a-fA-F]{64}$/,
    ETHEREUM: /^0x[0-9a-fA-F]{64}$/,
    SOLANA: /^[1-9A-HJ-NP-Za-km-z]{64,90}$/,
  };
  return patterns[network] && patterns[network].test(candidate) ? candidate : null;
}
