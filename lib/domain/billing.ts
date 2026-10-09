export const BILLING_PLAN_TIERS = [
  "FREE",
  "FOUNDER",
  "PROFESSIONAL",
  "FIRM",
  "ENTERPRISE",
] as const;
export type BillingPlanTier = typeof BILLING_PLAN_TIERS[number];

export const BILLING_ENTITLEMENT_KEYS = [
  "exploration",
  "formation.basic",
  "intelligence.analysis",
  "compliance.workflow",
  "workspace.clients",
  "workspace.count",
  "api.access",
  "enterprise.controls",
  "intelligence.credits",
  "professional_review",
] as const;

export type BillingEntitlementKind = "ACCESS" | "LIMIT" | "METERED" | "CREDIT";
export type BillingSubscriptionStatus =
  | "TRIALING"
  | "ACTIVE"
  | "PAST_DUE"
  | "PAUSED"
  | "CANCELED"
  | "ENDED";

export type BillingPlanEntitlement = {
  key: string;
  kind: BillingEntitlementKind;
  enabled: boolean;
  limit?: number | null;
  unit?: string | null;
};

export type BillingSubscription = {
  status: BillingSubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialEndsAt?: Date | null;
  cancelAtPeriodEnd: boolean;
};

export type BillingAccessDecision = {
  allowed: boolean;
  reason: "ACTIVE" | "SUBSCRIPTION_INACTIVE" | "OUTSIDE_BILLING_PERIOD" | "TRIAL_EXPIRED" | "ENTITLEMENT_NOT_INCLUDED" | "ENTITLEMENT_DISABLED" | "USAGE_LIMIT_REACHED" | "INVALID_REQUEST";
  entitlementKey: string;
  remaining?: number | null;
};

export type BillingCreditDirection = "CREDIT" | "DEBIT";
export type BillingCreditEntryType =
  | "GRANT"
  | "PURCHASE"
  | "USAGE"
  | "EXPIRY"
  | "REFUND"
  | "ADJUSTMENT";

export type BillingCreditEntry = {
  type: BillingCreditEntryType;
  direction: BillingCreditDirection;
  amount: number;
  creditType: string;
  idempotencyKey: string;
};

export type BillingUsageEvent = {
  entitlementKey: string;
  quantity: number;
  idempotencyKey: string;
};

function isValidDate(date: Date) {
  return date instanceof Date && !Number.isNaN(date.getTime());
}

export function hasBillingAccess(subscription: BillingSubscription, now = new Date()) {
  if (!isValidDate(now) ||
      !isValidDate(subscription.currentPeriodStart) ||
      !isValidDate(subscription.currentPeriodEnd) ||
      subscription.currentPeriodEnd <= subscription.currentPeriodStart) {
    return { allowed: false, reason: "INVALID_REQUEST" as const };
  }

  if (subscription.status !== "ACTIVE" && subscription.status !== "TRIALING") {
    return { allowed: false, reason: "SUBSCRIPTION_INACTIVE" as const };
  }

  if (now < subscription.currentPeriodStart || now >= subscription.currentPeriodEnd) {
    return { allowed: false, reason: "OUTSIDE_BILLING_PERIOD" as const };
  }

  if (subscription.status === "TRIALING" &&
      (!subscription.trialEndsAt ||
       !isValidDate(subscription.trialEndsAt) ||
       now >= subscription.trialEndsAt)) {
    return { allowed: false, reason: "TRIAL_EXPIRED" as const };
  }

  return { allowed: true, reason: "ACTIVE" as const };
}

export function checkBillingEntitlement(input: {
  subscription: BillingSubscription;
  entitlements: BillingPlanEntitlement[];
  entitlementKey: string;
  currentUsage?: number;
  requestedQuantity?: number;
  now?: Date;
}): BillingAccessDecision {
  const { entitlementKey } = input;
  const requestedQuantity = input.requestedQuantity ?? 1;
  const currentUsage = input.currentUsage ?? 0;

  if (!entitlementKey.trim() ||
      !Number.isSafeInteger(requestedQuantity) ||
      requestedQuantity <= 0 ||
      !Number.isSafeInteger(currentUsage) ||
      currentUsage < 0) {
    return { allowed: false, reason: "INVALID_REQUEST", entitlementKey };
  }

  const subscriptionAccess = hasBillingAccess(input.subscription, input.now);
  if (!subscriptionAccess.allowed) {
    return { allowed: false, reason: subscriptionAccess.reason, entitlementKey };
  }

  const entitlement = input.entitlements.find((item) => item.key === entitlementKey);
  if (!entitlement) {
    return { allowed: false, reason: "ENTITLEMENT_NOT_INCLUDED", entitlementKey };
  }
  if (!entitlement.enabled) {
    return { allowed: false, reason: "ENTITLEMENT_DISABLED", entitlementKey };
  }

  if (entitlement.kind !== "LIMIT") {
    return { allowed: true, reason: "ACTIVE", entitlementKey, remaining: null };
  }

  if (!Number.isSafeInteger(entitlement.limit) || entitlement.limit == null || entitlement.limit < 0) {
    return { allowed: false, reason: "INVALID_REQUEST", entitlementKey };
  }

  const remaining = Math.max(0, entitlement.limit - currentUsage);
  const allowed = requestedQuantity <= remaining;
  return {
    allowed,
    reason: allowed ? "ACTIVE" : "USAGE_LIMIT_REACHED",
    entitlementKey,
    remaining,
  };
}

export function calculateCreditBalance(entries: BillingCreditEntry[], creditType: string) {
  return entries
    .filter((entry) => entry.creditType === creditType)
    .reduce((balance, entry) => {
      if (!Number.isSafeInteger(entry.amount) || entry.amount <= 0) {
        throw new Error(`Credit ledger entry "${entry.idempotencyKey}" must have a positive integer amount.`);
      }
      if (entry.direction !== "CREDIT" && entry.direction !== "DEBIT") {
        throw new Error(`Credit ledger entry "${entry.idempotencyKey}" has an invalid direction.`);
      }

      const nextBalance = balance + (entry.direction === "CREDIT" ? entry.amount : -entry.amount);
      if (!Number.isSafeInteger(nextBalance)) {
        throw new Error("Credit ledger balance exceeds the safe integer range.");
      }
      if (nextBalance < 0) {
        throw new Error(`Credit ledger balance is negative for credit type "${creditType}".`);
      }
      return nextBalance;
    }, 0);
}

export function canApplyCreditEntry(
  entry: BillingCreditEntry,
  currentBalance: number,
) {
  if (!Number.isSafeInteger(entry.amount) ||
      entry.amount <= 0 ||
      !entry.creditType.trim() ||
      !entry.idempotencyKey.trim() ||
      !Number.isSafeInteger(currentBalance) ||
      currentBalance < 0 ||
      (entry.direction !== "CREDIT" && entry.direction !== "DEBIT")) {
    return false;
  }

  if (entry.direction === "CREDIT") return true;
  return entry.amount <= currentBalance;
}

export function canRecordUsageEvent(event: BillingUsageEvent) {
  return Boolean(
    event.entitlementKey.trim() &&
    event.idempotencyKey.trim() &&
    Number.isSafeInteger(event.quantity) &&
    event.quantity > 0,
  );
}
