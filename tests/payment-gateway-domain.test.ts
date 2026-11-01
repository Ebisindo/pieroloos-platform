import { describe, expect, it } from "vitest";
import {
  paymentControlConfiguration,
  allowedPaymentTransition,
  cryptoRailConfiguration,
  newPaymentReference,
  parseTransactionReference,
  paymentFeatureEnabled,
} from "@/lib/domain/payment-gateway";

describe("payment gateway configuration", () => {
  it("keeps all payment methods disabled unless explicitly enabled", () => {
    expect(paymentFeatureEnabled("STRIPE", {})).toBe(false);
    expect(paymentFeatureEnabled("BANK_TRANSFER", {})).toBe(false);
    expect(paymentFeatureEnabled("CRYPTO", {})).toBe(false);
  });

  it("requires overall and provider-specific Stripe flags and server credentials", () => {
    const env = {
      PAYMENTS_ENABLED: "true",
      STRIPE_PAYMENTS_ENABLED: "true",
      STRIPE_SECRET_KEY: "sk_test_example",
      STRIPE_WEBHOOK_SECRET: "whsec_example",
    };
    expect(paymentFeatureEnabled("STRIPE", env)).toBe(true);
    expect(paymentFeatureEnabled("STRIPE", { ...env, STRIPE_WEBHOOK_SECRET: "" })).toBe(false);
    expect(paymentFeatureEnabled("STRIPE", { ...env, PAYMENTS_ENABLED: "false" })).toBe(false);
  });

  it("requires verified and complete bank account instructions", () => {
    const env = {
      PAYMENTS_ENABLED: "true",
      BANK_TRANSFER_ENABLED: "true",
      BANK_TRANSFER_DETAILS_VERIFIED: "true",
      BANK_TRANSFER_ACCOUNT_HOLDER: "PieroloCorp International LLC",
      BANK_TRANSFER_BANK_NAME: "Lead Bank",
      BANK_TRANSFER_ACCOUNT_TYPE: "Checking",
      BANK_TRANSFER_ACCOUNT_NUMBER: "example-account",
      BANK_TRANSFER_ACH_ROUTING: "example-ach",
      BANK_TRANSFER_WIRE_ROUTING: "example-wire",
      BANK_TRANSFER_BANK_ADDRESS: "verified bank address",
      BANK_TRANSFER_CURRENCY: "USD",
      BANK_TRANSFER_SUPPORTED_SENDING_REGION: "US",
    };
    expect(paymentFeatureEnabled("BANK_TRANSFER", env)).toBe(true);
    expect(paymentFeatureEnabled("BANK_TRANSFER", { ...env, BANK_TRANSFER_DETAILS_VERIFIED: "false" })).toBe(false);
    expect(paymentFeatureEnabled("BANK_TRANSFER", { ...env, BANK_TRANSFER_ACCOUNT_NUMBER: "" })).toBe(false);
  });

  it("does not enable crypto rails without all independent configuration gates", () => {
    const base = {
      PAYMENTS_ENABLED: "true",
      CRYPTO_PAYMENTS_ENABLED: "true",
      CRYPTO_MANUAL_RECONCILIATION_ENABLED: "true",
      CRYPTO_USD_PARITY_QUOTE_APPROVED: "true",
      CRYPTO_TRON_ENABLED: "true",
      CRYPTO_TRON_RPC_URL: "https://rpc.example.invalid",
      CRYPTO_TRON_MAINNET_VERIFIED: "true",
      CRYPTO_TRON_MIN_CONFIRMATIONS: "20",
      CRYPTO_USDT_TRON_ADDRESS: `T${"1".repeat(33)}`,
      CRYPTO_USDT_TRON_ADDRESS_VERIFIED: "true",
      CRYPTO_USDT_TRON_TOKEN_ID: `T${"2".repeat(33)}`,
      CRYPTO_USDT_TRON_TOKEN_ID_VERIFIED: "true",
      CRYPTO_USDT_TRON_TOKEN_DECIMALS: "6",
      CRYPTO_USDT_TRON_TOKEN_DECIMALS_VERIFIED: "true",
    };
    expect(cryptoRailConfiguration(base)[0].enabled).toBe(true);
    expect(cryptoRailConfiguration({ ...base, CRYPTO_USDT_TRON_TOKEN_ID_VERIFIED: "false" })[0].enabled).toBe(false);
    expect(cryptoRailConfiguration({ ...base, CRYPTO_USDT_TRON_TOKEN_DECIMALS: "18" })[0].enabled).toBe(true);
    expect(cryptoRailConfiguration({ ...base, CRYPTO_USDT_TRON_TOKEN_DECIMALS_VERIFIED: "false" })[0].enabled).toBe(false);
    expect(cryptoRailConfiguration({ ...base, CRYPTO_USDT_TRON_ADDRESS_VERIFIED: "false" })[0].enabled).toBe(false);
  });
});

describe("payment control configuration", () => {
  it("fails closed on payment and subscription activation defaults", () => {
    const config = paymentControlConfiguration({});
    expect(config.paymentsEnabled).toBe(false);
    expect(config.stripeEnabled).toBe(false);
    expect(config.bankTransferEnabled).toBe(false);
    expect(config.cryptoEnabled).toBe(false);
    expect(config.subscriptionActivationEnabled).toBe(false);
    expect(config.reconciliationAdminOnly).toBe(true);
    expect(config.requireDistinctReviewer).toBe(true);
    expect(config.webhookMaxAgeSeconds).toBe(300);
  });

  it("bounds configured webhook signature timestamp tolerance", () => {
    expect(paymentControlConfiguration({ PAYMENT_WEBHOOK_MAX_AGE_SECONDS: "600" }).webhookMaxAgeSeconds).toBe(600);
    expect(paymentControlConfiguration({ PAYMENT_WEBHOOK_MAX_AGE_SECONDS: "1" }).webhookMaxAgeSeconds).toBe(300);
    expect(paymentControlConfiguration({ PAYMENT_WEBHOOK_MAX_AGE_SECONDS: "9999" }).webhookMaxAgeSeconds).toBe(300);
  });

  it("accepts only supported one-time Stripe checkout mode", () => {
    expect(paymentControlConfiguration({ STRIPE_CHECKOUT_MODE: "payment" }).stripeCheckoutMode).toBe("payment");
    expect(paymentControlConfiguration({ STRIPE_CHECKOUT_MODE: "subscription" }).stripeCheckoutMode).toBe("unsupported");
  });
});

describe("payment workflow rules", () => {
  it("produces non-empty distinct payment references", () => {
    const first = newPaymentReference();
    const second = newPaymentReference();
    expect(first).toMatch(/^PLO-[A-F0-9]{20}$/);
    expect(second).not.toBe(first);
  });

  it("does not permit a client claim to move directly from created to paid", () => {
    expect(allowedPaymentTransition("CREATED", "PAID")).toBe(false);
    expect(allowedPaymentTransition("CREATED", "PENDING_VERIFICATION")).toBe(true);
    expect(allowedPaymentTransition("PENDING_VERIFICATION", "PAID")).toBe(true);
    expect(allowedPaymentTransition("PAID", "PENDING_VERIFICATION")).toBe(false);
    expect(allowedPaymentTransition("PAID", "REFUNDED")).toBe(true);
  });

  it("validates transaction references conservatively by chain format", () => {
    expect(parseTransactionReference("a".repeat(64), "TRON")).toBe("a".repeat(64));
    expect(parseTransactionReference(`0x${"a".repeat(64)}`, "ETHEREUM")).toBe(`0x${"a".repeat(64)}`);
    expect(parseTransactionReference("x".repeat(50), "ETHEREUM")).toBeNull();
    expect(parseTransactionReference("0x" + "a".repeat(64), "SOLANA")).toBeNull();
  });
});
