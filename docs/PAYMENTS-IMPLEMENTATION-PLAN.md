# PieroloOS — Unified Payment Gateway Implementation

## Status

This branch records the scoped implementation contract and production release gates. It does **not** claim that live payment processing has been implemented or that any provider, bank account, wallet, token, or compliance requirement has been independently verified.

Existing repository inspection confirmed that the Prisma billing foundation already contains `BillingPlan`, `BillingSubscription`, `BillingInvoice`, `BillingPayment`, and `BillingWebhookEvent`. Current billing documentation explicitly says checkout, provider integration, webhook verification, reconciliation, customer-facing billing, and production entitlement enforcement remain unimplemented. Extend these foundations rather than creating duplicate billing models.

## Required architecture

Follow the repository's request path: origin check → authenticated session → workspace principal and permission → Zod validation → application service/domain rules → Prisma. Preserve organization/workspace isolation and use the existing database-backed platform Super Administrator and permission model for finance administration. Public clients may submit payment claims but cannot confirm receipt of funds or grant entitlements.

Implement provider-neutral payment services for Stripe, bank transfer claims/reconciliation, and cryptocurrency payment verification. Keep provider verification separate from payment initiation, reconciliation, invoice status, and subscription entitlement decisions.

## Feature flags

Use server-side flags, defaulting to disabled:

- `PAYMENTS_ENABLED=false`
- `STRIPE_PAYMENTS_ENABLED=false`
- `BANK_TRANSFER_ENABLED=false`
- `CRYPTO_PAYMENTS_ENABLED=false`

Provider/network availability must fail closed when credentials, token identity, destination verification, provider support, or other mandatory configuration is missing. A build or mock test is not production approval.

## Stripe

Use the official SDK and server-side configuration. Create sessions from trusted invoice data, associate provider objects with the invoice and organization, and do not trust browser redirects. Verify webhook signatures using the unmodified request body and official SDK. Persist event IDs using the existing unique `(provider, providerEventId)` constraint. Process duplicate and out-of-order events idempotently and handle success, failure, subscription lifecycle, refund, and dispute states according to actual event semantics.

Required configuration (names may be adapted consistently to existing conventions):

- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`

Never assume the separately supplied `gbsk_*` values are Stripe keys. Do not store them in source control. Any genuine exposed credentials should be rotated.

## Bank transfers

The account instructions supplied by the owner are intended for PieroloCorp International LLC through Grey/Lead Bank and include US ACH/wire transfer directions. They have not been independently verified by this repository change. Before exposing account details to customers, verify ownership, routing details, eligible sending institutions, fees, supported currencies, and current bank instructions directly with the financial institution.

For each invoice, issue a unique payment reference. The customer action “I've Sent the Bank Transfer” creates a pending claim only. It must not mark an invoice paid or activate subscription access.

Authorized finance users reconcile against independently obtained bank evidence, record the received amount/currency, bank reference, verification source, reviewer, timestamp, and reason, and approve/reject with an audit record. Do not allow a user to approve their own claim. Mismatches and duplicates require review.

Keep full account details out of public APIs, repository documentation, logs, committed environment examples, and unauthenticated pages. Store sensitive configuration in a protected runtime secret/configuration service. Display instructions only for an authenticated user with access to the corresponding invoice and only after they have been verified.

## Cryptocurrency payments

Requested combinations:

| Asset | Network |
| --- | --- |
| USDT | TRON |
| USDT | BNB Smart Chain |
| USDC | Ethereum |
| USDC | Solana |
| USDC | BNB Smart Chain |

Owner-supplied destination addresses are unverified input and must not be enabled solely because they were provided. Verify destination control, correct network, token contract or Solana mint, decimals, transfer event format, and the provider/RPC verification capability before enabling each rail. The same supplied BNB Smart Chain address is listed for USDT and USDC; this is not proof that both token transfers are supported.

Create immutable payment-order snapshots with invoice amount/currency, asset/network, expected token amount, quote source/time/expiry when fiat conversion is offered, destination, and payment expiry. Token amounts must use integer base units or exact decimal-safe arithmetic, never floating-point money calculations.

“I've Made the Payment” records a transaction-hash claim and sets pending verification only. Independently verify the transaction on the selected chain: success status, correct contract/mint, correct recipient, exact relevant token/program transfer, sufficient received amount and confirmations, no prior credit, correct order association, and order expiry policy. A top-level native transfer or transaction hash alone is insufficient. Provider outages, unknown token identities, mismatches, insufficient confirmations, and late/partial/overpayments must remain pending or require authorized review; they must never become false successes.

## Payment lifecycle and access

Keep payment and subscription states distinct. Define and validate allowed transitions in a domain service. A client submission cannot transition directly to paid. Only a verified provider event or an authorized, audited finance reconciliation can confirm receipt. Update payment and invoice state transactionally; update paid amounts without over-collection or duplicate credit; activate entitlements exactly once after confirmation and any required business checks. Use database uniqueness and transaction-safe idempotency, not only in-memory checks.

## Authorization, audit, and UX

- Every route/action must enforce session, request origin where applicable, resource ownership, organization/workspace scope, and server-side permission checks.
- Reuse the existing platform Super Admin and explicit permission scheme; do not trust browser-supplied roles.
- Audit reconciliation, manual corrections, configuration changes, and entitlement changes with actor, reason, timestamp, subject, and safe metadata.
- Include responsive invoice/payment states for pending verification, paid, failed, expired, and manual review; accessible status announcements and clear asset/network warnings.
- Notifications are emitted only after authoritative state changes and are idempotent.
- Avoid logging secrets, full account numbers, API keys, private keys, session tokens, or excess personal data.

## Data model and migrations

Extend existing billing models only where necessary. Likely supporting records include immutable payment orders, verification attempts/results, bank reconciliation evidence references, crypto transfer identifiers, and payment audit events. Use additive migrations and database indexes/unique constraints for provider events, invoice/payment references, and per-chain transfer identifiers. Retain existing records. Never reset/drop production tables for this feature.

## Test requirements

Use existing project scripts and test conventions to cover:

- Stripe signature failure, duplicate/out-of-order events, amount/currency/invoice mismatch, successful verified payment, failure/refund/dispute lifecycle.
- Bank claim remains pending; unauthorized/own-claim reconciliation denied; correct reconciliation, mismatch, duplicates and audit.
- Crypto wrong network/token/mint/recipient, failed/pending/insufficient-confirmation transactions, duplicate transaction, expired order, outage, partial/overpayment, and submitted-hash-only behavior.
- Cross-organization invoice access, admin route guards, payment amount tampering, idempotency, and one-time entitlement activation.
- `npm run db:validate`, `npm run db:inventory`, `npm run db:generate`, `npm run lint`, `npm run typecheck`, `npm test`, and build with required non-production environment configuration. Run database tests only with a disposable PostgreSQL database.

Do not report a check as passed unless it was actually executed. Do not use live funds for tests.

## External release gates

Before live enablement: validate provider account/business eligibility, verify bank instructions and destination control, verify each token contract/mint and chain verification setup, provision secret-manager credentials, validate webhook/chain confirmation policies, complete security and legal/compliance review, test staging end-to-end, and approve incident/reconciliation runbooks. Keep all flags disabled until these gates are satisfied.

## Delivery report required

Report exact files and migrations changed, tests and build actually run, integration capabilities implemented, configuration still required, details still unverified, blockers, and release-gate status. Clearly distinguish implementation from staging verification and production activation.
