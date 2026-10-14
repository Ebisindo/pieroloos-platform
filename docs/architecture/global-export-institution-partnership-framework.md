# PieroloOS Global Export Institution Partnership Framework

**Status:** Architecture proposal / implementation plan  
**Initial institution relationship status:** Prospective — Not Confirmed  
**Scope:** Country-agnostic institutional discovery, partnership governance and global exporter market-entry coordination  
**Related issue:** https://github.com/Ebisindo/pieroloos-platform/issues/7

> This document is a planning artifact. It does not establish an actual partnership, imply endorsement, or claim that the application features described here have already been implemented.

## 1. Intended capabilities

PieroloOS should support a reusable, global system to:

1. Discover and qualify relevant export-promotion agencies, trade ministries, export-development organizations and other trade-support institutions.
2. Keep a traceable record of official institutional details, mandate evidence, review dates, internal ownership and relationship status.
3. Manage prospective relationships through controlled, auditable lifecycle stages.
4. Support exporter onboarding, market readiness assessment, market intelligence, entry-model comparison, formation planning where appropriate, compliance coordination and professional escalation.
5. Support institution-specific programmes only after required institutional approvals and data-sharing arrangements.
6. Publish institutional information only after authorization, with no implied affiliation or endorsement.

## 2. Repository audit status and required next steps

The repository should be inspected in a checked-out development environment before application code or database schemas are changed. The GitHub integration's metadata access confirms that the repository exists and that its default branch is `main`; it does not provide a full working-tree, runtime, schema, test or deployment audit.

**Audit items still to complete in the repository workspace:**

- Identify framework, source layout, entry points and build/test commands.
- Map authentication, existing roles, Super Admin checks and server-side authorization.
- Find existing institution, partner, organization, provider and country/jurisdiction models.
- Inspect database/migration conventions and test fixtures.
- Inspect current navigation, UI design system, localization and accessibility conventions.
- Inspect audit logging, file/document handling, privacy controls and existing compliance workflows.
- Identify existing public directory/profile and SEO behaviors.
- Record exact files and schema changes before implementation.

Do not infer or fabricate any of these findings.

## 3. Proposed domain model

Adapt these concepts to existing schemas instead of introducing duplicate records.

### Institution
- Stable internal identifier.
- Official name, acronym and aliases.
- Institution category and legal/administrative type.
- Scope: national, subnational, regional, multilateral or other.
- Country/jurisdiction links where applicable; an institution may span multiple jurisdictions.
- Official website and official public contact channels.
- Publicly documented mandate and service categories.
- Internal owner and relationship status.
- Visibility/publication status.
- Created/updated metadata and audit history.

### EvidenceSource
- Institution relationship.
- Source URL and source title.
- Source class: official primary source, secondary source, user-provided, or other configured category.
- Claim(s) supported.
- Retrieved/observed date, publication date when available, verification date and next review date.
- Reviewer and notes.
- Verification status and limitations.

### PartnershipRelationship
- Institution identifier.
- Status and permitted next transitions.
- Internal relationship owner.
- Proposed collaboration areas and scope.
- Due-diligence findings.
- Outreach authorization record.
- Evidence reference for any formal approval.
- Agreement reference and effective/expiry dates only when applicable.
- Public-announcement authorization.
- Audit history.

### ExporterProfile
- Business identity and home jurisdiction.
- Products/services and sector.
- Export experience, capabilities and objectives.
- Target markets.
- Institutional registration status marked self-declared unless validly verified.
- Consent records and access permissions.
- Data minimization/retention metadata.

### MarketEntryAssessment
- Exporter and destination market.
- Assessment status and timestamp.
- Evidence sources and source dates.
- Commercial, regulatory and operational factors.
- Assumptions, uncertainties and missing information.
- Assessment author/reviewer and professional escalation needs.

### EntryModelOption
Model types may include direct exporting without foreign incorporation, distributor/agent, contractual arrangement, joint venture, branch, subsidiary or other suitable structure. Store rationale, benefits, risks, dependencies, evidence and professional-review requirements; do not assume incorporation is always necessary.

### FormationRoadmap / ComplianceTask
- Selected jurisdiction and entry model.
- Requirement description and authoritative source.
- Applicable date/version and last reviewed date.
- Evidence confidence/provenance.
- Responsible party, deadline, dependencies and status.
- Approval requirements, completion evidence and unresolved blockers.
- Recurrence/renewal data where relevant.

### Programme / DataSharingAuthorization
- Institution and programme scope.
- Eligibility and participant responsibilities.
- Required approvals.
- Data categories, purpose, lawful basis/consent record, recipient, retention period and revocation process.
- Reporting definitions and access controls.
- Agreement references where applicable.

These are logical concepts, not confirmed existing database tables. Implement only after assessing the repository's persistence model.

## 4. Partnership status governance

Suggested workflow:

Researching → Researched → Concept Prepared → Internal Review → Outreach Authorized → Contacted → Discovery Discussions → Due Diligence → Draft Terms → Written Authorization Verified → Active Under Signed Agreement.

Additional statuses: Paused, Declined and Closed.

Rules:

- A new record is private and marked **Prospective — Not Confirmed**.
- Public publication and relationship status are separate controls.
- Reaching a later status requires authorized role checks and a validated transition.
- “Written Authorization Verified” and “Active Under Signed Agreement” require evidence, reviewer identity, review timestamp, and any required agreement details.
- A status update by itself never proves legal authorization.
- Record who changed status, when, previous and new values, rationale and evidence reference.
- Do not automatically contact institutions or publish claims.

## 5. Exporter workflow

1. Intake and transparent consent.
2. Readiness assessment.
3. Market research with source provenance.
4. Entry-model comparison, including non-incorporation options.
5. Jurisdiction-specific establishment roadmap only where appropriate.
6. Compliance tasks, dependencies, evidence and approvals.
7. Professional escalation for legal, tax, accounting, customs, immigration, banking, sanctions or regulated matters.
8. Ongoing reporting and corporate lifecycle review.

Requirements must distinguish verified official facts, secondary research, user-provided information, assumptions and matters needing professional review. Avoid guarantees about incorporation, banking, permits, incentives, buyers, market access or profitability.

## 6. Privacy, access control and public presentation

- Integrate with existing authentication and permissions; do not create a competing role system.
- Enforce sensitive operations server-side, not only by hiding frontend controls.
- Keep internal institutional records private by default.
- Apply least privilege, secure document access, audit logging, appropriate retention/deletion, data minimization and incident handling.
- Require consent and applicable legal/privacy review before exporter data is shared.
- Do not presume access to institution-held registration records.
- Separate public profile approval from relationship approval.
- Do not use institutional marks, logos or endorsement claims without written authorization.
- Where exploratory public copy has been approved, use: “Potential institutional partner — exploratory status only. No formal partnership or endorsement is implied.”
- Exclude confidential records and private routes from indexing.

## 7. Internationalization and accessibility

Reuse existing i18n/l10n infrastructure. Keep the official name and reviewed translation separate. Support locale-sensitive dates, numbers and currencies, and right-to-left presentation where required. Do not conflate country, language, currency and legal jurisdiction.

Follow the existing accessible design system for keyboard navigation, labels, error handling, status announcements, responsive layouts and semantic markup.

## 8. Evidence-based discovery

Use official government and institution sources wherever possible. Record the source, relevant claim, access/review date and limitations. Respect website terms, access controls and applicable laws. Automated discovery may suggest records for review but must not silently validate institutional claims or change relationship status. Do not invent staff, contact details, institutional powers or commitments.

## 9. Test strategy

Add repository-consistent tests for:

- Multiple institutions within the same country and institutions covering several jurisdictions.
- Data validation, duplicate handling and evidence references.
- Partnership status-transition rules and approval evidence.
- Server-side authorization and confidential-record access.
- Audit-event correctness.
- Public publication and branding safeguards.
- Exporter consent and restricted data-sharing.
- Entry-model comparison including export-only options.
- Roadmap source dates, unresolved items and completion evidence.
- Localization, accessibility and responsive behavior.
- Regression coverage for existing clients, partners, authentication and administration.

Execute the actual available checks and report results accurately; do not claim checks were run if they were not.

## 10. Phased implementation

1. Complete repository and architecture audit.
2. Confirm domain model and migrations against existing conventions.
3. Implement institutional directory and evidence records.
4. Implement lifecycle governance, permissions and audit logging.
5. Implement exporter intake and market-entry assessment.
6. Implement entry-model comparison, formation roadmaps and compliance coordination.
7. Add consent/data-sharing controls and approved public-profile flow.
8. Add internationalization/accessibility, automated tests and documentation.
9. Prepare an internal concept note and discovery-meeting pack.
10. Review security, privacy, legal boundaries and deployment readiness.

## 11. Release gates

Do not launch or represent the feature as production-ready until:

- Repository audit findings and code changes are documented.
- Migrations and rollback approach are reviewed.
- Server-side authorization and audit tests pass.
- Public/private visibility has been verified.
- Privacy and data-sharing controls are reviewed.
- Applicable accessibility and localization checks are completed.
- Outstanding professional/legal review requirements are disclosed.
- Public institutional claims have required written approvals.

## 12. Required completion report

Report exact files changed, schemas/migrations, implemented workflows, permissions, evidence and audit mechanisms, tests actually executed and their outcomes, unresolved risks, deployment steps, and approvals still required.

This framework remains a proposal until code is implemented and reviewed; any institution remains a prospective partner until the appropriate relationship is documented and authorized.
