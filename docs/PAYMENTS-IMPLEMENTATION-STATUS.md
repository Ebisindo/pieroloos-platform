# PieroloOS — Payment Gateway Implementation Status

## Scope of the current feature branch

This branch implements a first payment-processing slice on top of the existing Prisma billing foundation. It is **not** an approval to accept live payments and is not yet production-ready.

Implemented code paths:

- `/billing`: organization-scoped invoice and payment history for workspace owners/admins.
- `POST /api/billing/stripe/checkout`: creates a server-priced Stripe hosted Checkout Session for an open invoice.
- `POST /api/billing/stripe/webhook`: verifies Stripe's timestamped HMAC signature against the raw request body, records provider event IDs and payload hashes, and handles successful checkout, payment failure, and partial/full charge-refund events idempotently.
- `POST /api/billing/bank-transfer`: initiates an order with an internal payment reference, returns runtime-configured instructions only after the bank details verification flag is set, and accepts a separate customer-submitted transfer claim.
- `POST /api/billing/crypto`: creates an immutable crypto order before sending funds, snapshots the selected token/network/destination/decimals/expected base units/expiry, and records a transaction-hash claim after the user reports payment.
- `lib/services/crypto-chain-verifier.ts`: read-only verification against configured EVM Ethereum/BNB Smart Chain RPC, TRON full-node API and Solana RPC. It checks network identity (EVM chain ID), transaction success, the configured token contract or mint, destination address/owner, exact token-transfer amount and the configured confirmation/finality threshold. The Super Admin approval endpoint invokes this verifier before posting a successful crypto payment.
- `/admin/payments` and `/api/admin/payments`: restrict finance review and reconciliation decisions to the platform Super Administrator, require independent evidence references and a reason, audit the decision, and update the invoice transactionally.
- Verified invoice payment can activate a linked subscription only when the subscription is in an eligible status and its current period includes the current time; otherwise the payment is recorded and a review event is written.

The implementation reuses `BillingPlan`, `BillingSubscription`, `BillingInvoice`, `BillingPayment`, `BillingWebhookEvent`, and `PlatformAuditEvent`. No Prisma migration was needed for this first slice. Payment-order and claim metadata are currently stored in audit JSON, so a normalized payment-order/reconciliation model should be considered before a larger production launch.

## Important limits (not implemented or not verified)

1. **Stripe uses the official Stripe HTTPS API directly, not the Stripe Node SDK.** The current checkout is hosted one-time Checkout. Embedded Checkout, Stripe-managed recurring subscription creation/renewal, customer portal, disputes, tax, proration, pricing catalogue, invoice generation, and a full refund UI/policy are not part of this slice.
2. **Cryptocurrency verification is RPC-backed when an operator configures and verifies each endpoint.** A submitted hash never proves payment. The server requires an explicit RPC URL, mainnet-verification flag, confirmation threshold, and independently verified destination, token contract/mint and decimal count for each rail. Pending, failed and mismatched chain results block approval. A provider outage can be handled only through a separate, audited Super Administrator manual-review override when `CRYPTO_MANUAL_RECONCILIATION_ENABLED=true`; the operator must inspect independent chain evidence. No RPC URL, destination, contract/mint or confirmation policy has been configured or independently verified in this repository, so all crypto rails remain disabled by default.
3. **Bank transfers are manually reconciled.** “I've Sent the Bank Transfer” only submits a claim. A separate Super Admin must match independent bank evidence. No bank statement feed or automated bank reconciliation exists.
4. Payment entitlement checks have not been connected to every paid feature/API. A successful payment updates its invoice and may update a linked subscription, but this should not be interpreted as complete route-by-route subscription access enforcement.
5. No commercial price book, tax rules, credit purchase/expiry policy, payment notification worker, customer cancellation UI, or operational reconciliation dashboard for provider webhook failures has been implemented in this increment.
6. Bank account instructions, bank fees, wallet destination addresses, token identifiers/mints, token decimals, USD-parity quote policy, provider account eligibility and applicable compliance obligations have not been independently verified.
7. A successful CI build alone does not establish production readiness. Current automated test status must be checked in the branch's GitHub Actions runs.

## Security and configuration

All feature flags are disabled in `.env.example`:

- `PAYMENTS_ENABLED=false`
- `STRIPE_PAYMENTS_ENABLED=false`
- `BANK_TRANSFER_ENABLED=false`
- `CRYPTO_PAYMENTS_ENABLED=false`

Keep them disabled until:
- Stripe test-mode configuration and webhook verification have passed.
- Bank account ownership and exact receiving instructions have been independently confirmed with the institution.
- Each wallet address, token contract/mint, and the exact token decimal count has been independently verified.
- The 1:1 USD stablecoin quote policy is explicitly approved by the financial owner; stablecoins are not guaranteed to trade at par.
- Authorized reconciliation, access-control, replay/idempotency, refund, and invoice-race tests pass.
- Legal, tax, regulatory, AML/KYC, sanctions, privacy and provider eligibility review is complete.
- Staging has been tested without live funds and an authorized operator signs off on launch.

Never commit secrets or full bank account details. Configure sensitive values in deployment secret management. If any of the previously shared API-like credentials are genuine and active, rotate them; do not assume they are Stripe credentials.

## Validation commands

Run from a clean checkout on the feature branch:

```sh
npm run db:validate
npm run db:inventory
npm run db:generate
npm run lint
npm run typecheck
npm test
NEXTAUTH_SECRET=<non-production-test-secret> DATABASE_URL=<disposable-postgres-url> npm run build
```

`npm run test:db` requires a disposable PostgreSQL database. Do not point schema or migration tests at production. Record the actual CI status in the pull request before marking the work review-ready.
