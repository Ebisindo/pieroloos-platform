# Partnership Strategy and Inquiry Workflow

## Status

The partner programme is **in design**. Nothing below implies an agreement. No partners, sponsors or funding are announced or secured. Public copy must keep saying so until that changes.

## Strategy

Positioning: *Build the Infrastructure Behind Better Businesses.* PieroloOS invites strategic partners, technology providers, professional firms, institutions and sponsors to help build business-formation infrastructure.

| Category | Possible contribution | Potential value (never guaranteed) |
| --- | --- | --- |
| Professional services | Review of workflows and content; qualified advice | Ecosystem visibility, possible qualified referrals |
| Technology providers | Integrations and technical expertise | Integration and co-development opportunities |
| Financial institutions | Onboarding and account-opening insight | Engagement with well-documented businesses |
| Institutional partners | Research, standards, education | Co-created resources, thought leadership |
| Strategic sponsors and investors | Development funding and guidance | Founding-partner recognition, networking; no return promised |
| Distribution and ecosystem partners | Founder access and market knowledge | Cross-border opportunities |

Rules: do not promise referrals, revenue, customers or regulatory outcomes; do not name partners without written agreement; software organises, licensed professionals decide.

### Funding presentation (planning estimates only)

Public page `/partners` shows an indicative programme of ₦45M–₦81M, a proposed target of ₦60M, and four phases (I ₦5M–₦8M, II ₦15M–₦22M, III ₦10M–₦15M, IV ₦10M–₦20M). They are not quotations or commitments. **Known inconsistency:** the phase ranges sum to ₦40M–₦65M, which does not reconcile to ₦45M–₦81M; the page says so. Resolve before sharing externally. A detailed budget, schedule, staffing assumptions and measurable milestones are required before any formal investment discussion.

## Inquiry workflow

1. A visitor completes the form on `/partners` (`components/public/PartnershipInquiryForm.tsx`): partner type, organisation, name, email, optional website and country, message, consent.
2. `POST /api/partnerships/inquiries` (`app/api/partnerships/inquiries/route.ts`):
   - rejects cross-origin requests (403), applies a global limit (200/hour) and a per-client limit (5/hour) (429), caps the body at 16 KB (413), requires JSON (400);
   - validates with `lib/validation/partnership-inquiry.ts` (422 with field errors); unknown fields and a filled honeypot are rejected;
   - stores via `lib/services/partnership-inquiry-service.ts` and `lib/db/partnership-inquiry-repository.ts`; returns only `{ id }`; failures return a generic 500.
3. Optional alert: if `PARTNERSHIP_INQUIRY_NOTIFY_EMAIL` and SMTP are configured, a content-free email is sent through `lib/services/notification-email.ts` (template `partnership-inquiry`). Failure is logged without content and never fails the submission.
4. Review: `GET /api/partnerships/inquiries` returns the newest 100 inquiries to platform administrators only (401 unauthenticated, 403 otherwise). There is no review UI and nothing yet changes `status` (NEW, IN_REVIEW, CLOSED).

Data: table `PartnershipInquiry` (migration `20261011120000_partnership_inquiries`). It is not tenant-scoped and holds personal data. A privacy notice and retention policy are still required.

Tests: `tests/partnership-inquiry-route.test.ts` (valid, missing fields, invalid email and URL, oversized message, unsupported type, honeypot, database failure, notification failure, rate limit, origin, access control). These mock the database; the migration has not been applied in this repository's checks.

## Not built

Partner accounts and scoped access, onboarding, directory, referral workflow, inquiry review UI, commission or terms handling. Any partner access to client data must be explicit, grant-based and audited, following the `ClientPortalGrant` pattern, and must not reuse workspace membership.
