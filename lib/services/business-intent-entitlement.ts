import type { Prisma } from "@prisma/client";

export const BUSINESS_INTENT_ENTITLEMENT_KEY = "AI_INTENT_ANALYSIS";

export async function assertBusinessIntentEntitlement(
  transaction: Prisma.TransactionClient,
  organizationId: string,
  now = new Date(),
) {
  const subscription = await transaction.billingSubscription.findFirst({
    where: {
      organizationId,
      status: { in: ["ACTIVE", "TRIALING"] },
      currentPeriodEnd: { gt: now },
      plan: {
        is: {
          active: true,
          entitlements: {
            some: { key: BUSINESS_INTENT_ENTITLEMENT_KEY, enabled: true },
          },
        },
      },
    },
    select: {
      currentPeriodStart: true,
      plan: {
        select: {
          entitlements: {
            where: { key: BUSINESS_INTENT_ENTITLEMENT_KEY, enabled: true },
            select: { limit: true, kind: true },
          },
        },
      },
    },
  });

  const entitlement = subscription?.plan.entitlements[0];
  if (!subscription || !entitlement) {
    throw new Error("AI_ENTITLEMENT_REQUIRED");
  }

  if (entitlement.limit !== null) {
    const used = await transaction.billingUsageEvent.count({
      where: {
        organizationId,
        entitlementKey: BUSINESS_INTENT_ENTITLEMENT_KEY,
        occurredAt: { gte: subscription.currentPeriodStart },
      },
    });
    if (used >= entitlement.limit) throw new Error("AI_USAGE_LIMIT_REACHED");
  }

  return { periodStart: subscription.currentPeriodStart, limit: entitlement.limit };
}
