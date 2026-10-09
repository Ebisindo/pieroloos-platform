# Session 25 — Billing, Entitlements & Monetization

## Foundation implemented

Billing is represented as organization-level customer state rather than an add-on to individual feature routes:

```text
Organization/customer → versioned plan catalog → explicit entitlements
  → idempotent workspace-aware usage events and credit ledger
  → invoice and line items → provider payment records
  → subscription-based access decision
```

`prisma/schema.prisma` and migration `20261006154500_billing_entitlements_foundation` define:

- Configurable `FREE`, `FOUNDER`, `PROFESSIONAL`, `FIRM`, and `ENTERPRISE` plan tiers, plan versions, and catalog entitlements.
- Organization-scoped subscriptions, including lifecycle status, billing interval, trial window, current period, provider reference, and scheduled cancellation.
- Usage events with workspace scope where applicable and organization-wide idempotency keys.
- An append-oriented credit ledger with distinct credit/debit direction, credit types, and idempotency keys. Balances are derived from entries instead of overwritten counters.
- Invoices denominated in integer minor currency units, categorized invoice lines, payment/refund records, and provider-event deduplication metadata containing payload hashes rather than raw webhook payloads.
- Composite workspace/organization foreign keys for workspace-scoped usage and credit entries.

`lib/domain/billing.ts` provides provider-neutral access and entitlement checks, metered-limit checks, positive/idempotent usage validation, and credit balance/overspend guards. Scheduled cancellation retains access to the end of the current period. The initial access check fails closed for past-due, paused, ended, or out-of-period subscriptions; any grace period or collection policy must be explicitly decided before production enforcement.

No prices, quota values, per-plan feature bundles, included credits, or commercial policy are seeded. The tier names are catalog categories, not promises about what is included. Entitlement keys express independent product capabilities, allowing subscriptions, intelligence credits, and professional-review purchases to be packaged separately when approved.

## Not enabled for customers

This is a schema and domain foundation, not a billing launch. There is no payment processor integration, webhook signature verification or worker, checkout/customer portal, tax calculation, invoice generation, pricing UI, plan administration, entitlement repository/API, application-route feature enforcement, usage instrumentation, credit purchase/expiry policy, professional-review fulfilment flow, or reconciliation/refund operations.

The current schema records provider event IDs and payload hashes for future idempotent processing; it does not itself authenticate or process provider events. Likewise, domain entitlement decisions are not yet wired into existing route authorization. Do not rely on this increment to grant or revoke production access.

## Decisions and exit work

Before pilot billing:

1. Approve a price book by currency, billing interval, plan/version, taxes, discounts, refunds, and proration behavior.
2. Decide per-tier capabilities, workspace/client limits, included usage, credit packages/expiry, overage policy, and whether professional review is a separately purchasable service.
3. Choose a payment provider and implement authenticated, idempotent webhook ingestion, retries, reconciliation, invoice/payment state transitions, and audit ownership.
4. Add repository/services for safe subscription, entitlement, usage, credit, invoice, and payment transactions; prevent overspend under concurrency.
5. Enforce access and limits server-side consistently across existing APIs and background work; define customer communications and a reviewed past-due grace policy.
6. Add checkout/management UI only after pricing and cancellation/refund policies are approved.
7. Test duplicate and out-of-order provider events, tenant boundaries, concurrent quota/credit consumption, cancellations, payment failures, refunds, and access reconciliation against a staging provider account.

## Verification boundary

Domain tests verify configured-entitlement checks, configured quota checks, subscription period and status handling, scheduled cancellation, idempotent usage input requirements, and credit balance/overspend rules. Prisma schema validation and generation verify the model/migration contract. Production migration replay, provider integration, race safety, billing reconciliation, customer-facing access enforcement, and commercial/legal approval remain outstanding.
