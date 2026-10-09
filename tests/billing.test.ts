import { describe, expect, it } from "vitest";
import {
  BILLING_ENTITLEMENT_KEYS,
  canApplyCreditEntry,
  canRecordUsageEvent,
  calculateCreditBalance,
  checkBillingEntitlement,
  hasBillingAccess,
  type BillingCreditEntry,
  type BillingPlanEntitlement,
  type BillingSubscription,
} from "@/lib/domain/billing";

const now = new Date("2026-10-06T12:00:00.000Z");
const subscription: BillingSubscription = {
  status: "ACTIVE",
  currentPeriodStart: new Date("2026-10-01T00:00:00.000Z"),
  currentPeriodEnd: new Date("2026-11-01T00:00:00.000Z"),
  cancelAtPeriodEnd: false,
};

describe("billing entitlement domain", () => {
  it("defines independent commercial capabilities rather than assuming a single subscription bundle", () => {
    expect(BILLING_ENTITLEMENT_KEYS).toEqual(expect.arrayContaining([
      "formation.basic",
      "intelligence.analysis",
      "compliance.workflow",
      "workspace.clients",
      "workspace.count",
      "api.access",
      "intelligence.credits",
      "professional_review",
    ]));
  });

  it("allows included entitlements and rejects entitlements not configured for the plan", () => {
    const entitlements: BillingPlanEntitlement[] = [
      { key: "formation.basic", kind: "ACCESS", enabled: true },
      { key: "professional_review", kind: "ACCESS", enabled: false },
    ];

    expect(checkBillingEntitlement({
      subscription,
      entitlements,
      entitlementKey: "formation.basic",
      now,
    })).toMatchObject({ allowed: true, reason: "ACTIVE" });
    expect(checkBillingEntitlement({
      subscription,
      entitlements,
      entitlementKey: "professional_review",
      now,
    })).toMatchObject({ allowed: false, reason: "ENTITLEMENT_DISABLED" });
    expect(checkBillingEntitlement({
      subscription,
      entitlements,
      entitlementKey: "api.access",
      now,
    })).toMatchObject({ allowed: false, reason: "ENTITLEMENT_NOT_INCLUDED" });
  });

  it("enforces a configured usage limit without inventing a default quota", () => {
    const entitlements = [{
      key: "workspace.clients",
      kind: "LIMIT" as const,
      enabled: true,
      limit: 10,
      unit: "clients",
    }];

    expect(checkBillingEntitlement({
      subscription,
      entitlements,
      entitlementKey: "workspace.clients",
      currentUsage: 8,
      requestedQuantity: 2,
      now,
    })).toMatchObject({ allowed: true, remaining: 2 });
    expect(checkBillingEntitlement({
      subscription,
      entitlements,
      entitlementKey: "workspace.clients",
      currentUsage: 8,
      requestedQuantity: 3,
      now,
    })).toMatchObject({ allowed: false, reason: "USAGE_LIMIT_REACHED", remaining: 2 });
    expect(checkBillingEntitlement({
      subscription,
      entitlements: [{ ...entitlements[0], limit: null }],
      entitlementKey: "workspace.clients",
      now,
    })).toMatchObject({ allowed: false, reason: "INVALID_REQUEST" });
  });

  it("fails closed for inactive, expired, malformed, and out-of-period subscriptions", () => {
    expect(hasBillingAccess({ ...subscription, status: "PAST_DUE" }, now))
      .toMatchObject({ allowed: false, reason: "SUBSCRIPTION_INACTIVE" });
    expect(hasBillingAccess({ ...subscription, currentPeriodEnd: now }, now))
      .toMatchObject({ allowed: false, reason: "OUTSIDE_BILLING_PERIOD" });
    expect(hasBillingAccess({
      ...subscription,
      status: "TRIALING",
      trialEndsAt: new Date("2026-10-06T11:00:00.000Z"),
    }, now)).toMatchObject({ allowed: false, reason: "TRIAL_EXPIRED" });
    expect(hasBillingAccess({
      ...subscription,
      currentPeriodEnd: subscription.currentPeriodStart,
    }, now)).toMatchObject({ allowed: false, reason: "INVALID_REQUEST" });
  });

  it("allows access until period end for a scheduled cancellation", () => {
    expect(hasBillingAccess({
      ...subscription,
      cancelAtPeriodEnd: true,
    }, now)).toMatchObject({ allowed: true, reason: "ACTIVE" });
  });

  it("computes append-only credit balances and rejects spending beyond balance", () => {
    const entries: BillingCreditEntry[] = [
      { type: "PURCHASE", direction: "CREDIT", amount: 100, creditType: "intelligence", idempotencyKey: "purchase-1" },
      { type: "USAGE", direction: "DEBIT", amount: 35, creditType: "intelligence", idempotencyKey: "analysis-1" },
      { type: "GRANT", direction: "CREDIT", amount: 20, creditType: "professional-review", idempotencyKey: "grant-1" },
    ];

    expect(calculateCreditBalance(entries, "intelligence")).toBe(65);
    expect(calculateCreditBalance(entries, "professional-review")).toBe(20);
    expect(canApplyCreditEntry({
      type: "USAGE",
      direction: "DEBIT",
      amount: 65,
      creditType: "intelligence",
      idempotencyKey: "analysis-2",
    }, 65)).toBe(true);
    expect(canApplyCreditEntry({
      type: "USAGE",
      direction: "DEBIT",
      amount: 66,
      creditType: "intelligence",
      idempotencyKey: "analysis-3",
    }, 65)).toBe(false);
    expect(() => calculateCreditBalance([
      ...entries,
      { type: "USAGE", direction: "DEBIT", amount: 86, creditType: "intelligence", idempotencyKey: "analysis-overdrawn" },
    ], "intelligence")).toThrow(/negative/);
  });

  it("requires positive, idempotent usage measurements", () => {
    expect(canRecordUsageEvent({
      entitlementKey: "intelligence.analysis",
      quantity: 1,
      idempotencyKey: "analysis-request-1",
    })).toBe(true);
    expect(canRecordUsageEvent({
      entitlementKey: "intelligence.analysis",
      quantity: 0,
      idempotencyKey: "analysis-request-2",
    })).toBe(false);
    expect(canRecordUsageEvent({
      entitlementKey: "intelligence.analysis",
      quantity: 1,
      idempotencyKey: " ",
    })).toBe(false);
  });
});
