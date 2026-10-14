import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicShell } from "@/components/public/PublicShell";
import { publicPageMetadata } from "@/lib/site";

const docs = {
  "privacy": {
    "id": "PRIV-001",
    "title": "Privacy Policy",
    "purpose": "Explains how personal information is handled and what must be verified before data is submitted.",
    "body": [
      "PieroloOS may process account and authentication details, client intake and business profile information, documents and evidence, workspace membership and permissions, partnership inquiries, support communications, security events, audit records, and limited technical or diagnostic information where those activities are implemented.",
      "The exact categories, purposes, lawful bases, recipients and subprocessors, analytics or cookies, retention periods, deletion processes, international transfers, user rights and privacy contact must be confirmed against deployed code, database models, hosting, identity providers, storage, email, monitoring and operational procedures before this notice is approved.",
      "Submit only information necessary for the intended workflow and only when authorised. Do not send passwords, private keys, payment-card details or unnecessary sensitive personal data through general enquiry forms. A draft page does not mean a completed privacy compliance assessment.",
      "Requests to access, correct, delete or otherwise exercise privacy rights must use a verified contact and process published by the operator after approval. Applicable statutory rights remain governed by the laws that apply to the relevant processing."
    ],
    "blockers": [
      "Complete data-flow and provider inventory",
      "Confirm controller/processor roles and lawful bases by purpose",
      "Verify retention, deletion, international transfer and breach-handling practices",
      "Publish verified privacy contact and legally reviewed disclosures"
    ]
  },
  "cookies": {
    "id": "COOK-001",
    "title": "Cookie Policy",
    "purpose": "Describes cookies and similar technologies after the actual browser storage is audited.",
    "body": [
      "The deployed application documents a locale preference cookie. Authentication and other framework or security storage must be inventoried before this policy is approved. This draft does not assert that analytics or advertising cookies are used.",
      "Before publication, record each verified cookie or storage key, provider, purpose, expiry, classification, and whether consent is required. Essential operation does not automatically justify classifying all storage as essential.",
      "Where consent is required, the product must offer a working choice, persist the preference, honour it on later visits and provide a practical withdrawal mechanism. Do not publish a consent claim until the implementation is verified."
    ],
    "blockers": [
      "Inventory actual cookies and browser storage on public and authenticated flows",
      "Confirm regional consent requirements",
      "Implement and test any required consent and withdrawal mechanism"
    ]
  },
  "acceptable-use": {
    "id": "AUP-001",
    "title": "Acceptable Use Policy",
    "purpose": "Sets proposed boundaries for lawful and authorised platform use.",
    "body": [
      "Use the Platform only lawfully and within granted permissions. Do not impersonate others, make fraudulent submissions, access unrelated accounts or workspaces, bypass access controls, introduce malicious code, interfere with service availability, abuse automated requests, scrape protected information without authority, infringe intellectual property, misuse client or partner information, or alter evidence and audit trails deceptively.",
      "Do not submit passwords, private keys, payment-card data or other secrets through general enquiry fields. Report suspected misuse through a verified support or security channel when one is available.",
      "Any enforcement process must be proportionate, documented and consistent with applicable law, contractual commitments, appeal rights and mandatory consumer protections. This draft does not establish a new automated suspension capability."
    ],
    "blockers": [
      "Confirm abuse-reporting contact and operational response process",
      "Review enforcement, notice and appeal procedures"
    ]
  },
  "security": {
    "id": "SEC-001",
    "title": "Information Security Policy",
    "purpose": "Summarises the documented security architecture without disclosing confidential internals or making unverified operational promises.",
    "body": [
      "The architecture documents authentication, server-side permission checks, workspace and client-portal scope, least-privilege role assignments, private document storage, integrity hashes, scan status and audit events for sensitive writes. These are documented design and code-level characteristics, not independent certification or proof that every production control is correctly configured.",
      "Do not interpret this page as a claim of encryption at every stage, penetration testing, a security certification, specific backup frequency, recovery objectives or uninterrupted monitoring unless the relevant control has verified operational evidence.",
      "Report suspected vulnerabilities through a verified official channel once published. Do not include credentials, access tokens, private keys or exploit details in a public forum. Internal response playbooks and sensitive architecture remain confidential."
    ],
    "blockers": [
      "Verify production configuration and operational control evidence",
      "Confirm incident response and responsible-disclosure contact",
      "Verify backup/restore rehearsal and monitoring before making commitments"
    ]
  },
  "data-retention": {
    "id": "RET-001",
    "title": "Data Retention and Deletion Policy",
    "purpose": "States the intended retention approach while exact retention periods are verified.",
    "body": [
      "Retention should depend on the record category, purpose, contractual context, applicable law and operational requirements. Categories requiring review include account records, client profiles, uploaded documents, evidence and source references, partnership inquiries, authentication and security logs, audit trails, billing records if introduced, and backups.",
      "Specific retention periods, deletion timing, backup expiry, legal holds, anonymisation and post-closure access have not been confirmed for this public draft. No immediate-deletion guarantee is made. Data subject requests must be handled through an approved process that accounts for applicable law and legitimate retention requirements."
    ],
    "blockers": [
      "Create and approve a category-by-category retention schedule",
      "Verify deletion and backup lifecycle behaviour",
      "Define verified request intake and legal-hold procedures"
    ]
  },
  "data-processing": {
    "id": "DPA-001",
    "title": "Data Processing and Subprocessor Policy",
    "purpose": "Explains what must be established for organisation data processing and external services.",
    "body": [
      "Controller and processor roles must be determined for each activity and contractual context, not assumed globally. Before final publication, identify the hosting, storage, authentication, email, observability and other providers actually used, together with processing locations and applicable transfer safeguards.",
      "Where required, use an appropriate data-processing agreement defining instructions, confidentiality, security measures, subprocessors, incident notification, data-subject requests, retention and deletion, transfers and any applicable audit arrangements. This public overview is not a substitute for a required signed agreement."
    ],
    "blockers": [
      "Inventory actual subprocessors and processing locations",
      "Complete role and transfer assessment",
      "Prepare approved data-processing agreement where required"
    ]
  },
  "subscription": {
    "id": "SUB-001",
    "title": "Subscriber Terms and Subscription Policy",
    "purpose": "Provides a product-status notice until commercial subscription operations are enabled.",
    "body": [
      "Billing and entitlements are currently recorded in product documentation as prepared domain/schema foundations only. A payment provider and customer-facing billing, invoice and cancellation flow are not currently documented as operational.",
      "Do not treat prototypes, internal configuration or roadmap descriptions as an offer to purchase. Before subscriptions launch, publish applicable plans, entitlements, limits, price, currency, taxes, billing period, renewals, failed-payment handling, suspension, cancellation and applicable statutory rights."
    ],
    "blockers": [
      "Product and finance approval of actual offers and entitlements",
      "Payment provider and user-facing billing flow must be implemented and tested before accepting payment"
    ]
  },
  "billing": {
    "id": "BILL-001",
    "title": "Billing Policy",
    "purpose": "Explains the billing disclosure gate without inventing payment features.",
    "body": [
      "No active payment provider, invoicing or customer-facing billing flow is documented as operational in the current product description. This is an availability notice, not an offer, invoice, quotation or promise to process payment.",
      "Before any supported purchase, the authorised offer and checkout must clearly display total price, currency, applicable taxes, billing cycle, renewal terms, payment provider, cancellation and refund terms before the user commits. Transactions and payment data must be processed only through verified, authorised systems."
    ],
    "blockers": [
      "Verify deployed payment functionality and provider",
      "Approve price lists, taxes, invoices and disclosures"
    ]
  },
  "refunds-cancellations": {
    "id": "REF-001",
    "title": "Refund, Cancellation and Withdrawal Policy",
    "purpose": "Records requirements for a future approved commercial policy.",
    "body": [
      "No universal no-refund rule or refund entitlement is created by this draft. Where a paid service is offered, the authorised offer must disclose cancellation steps, refund eligibility, any verified processing timeframe, duplicate or failed transaction handling, payment disputes, digital-service rules and mandatory consumer cancellation or withdrawal rights.",
      "Rules may vary by jurisdiction and service type, including bespoke professional services. Contract language must not remove statutory protections or rights that cannot lawfully be waived."
    ],
    "blockers": [
      "Verify actual paid products and cancellation flows",
      "Obtain jurisdiction-appropriate consumer law review",
      "Approve operational refund handling process before launch"
    ]
  },
  "intellectual-property": {
    "id": "IP-001",
    "title": "Intellectual Property Policy",
    "purpose": "Outlines proposed boundaries for platform, user and third-party rights.",
    "body": [
      "The operator or its licensors may hold rights in platform software, original content and brand assets. Users retain rights in User Content as stated in the draft Terms; uploading content does not by itself transfer ownership to PieroloOS.",
      "Third-party materials are governed by their own licences and rights. Do not imply endorsement, partnership or affiliation through unauthorised use of names or logos. Copyright notices and takedown procedures must use verified contact details and comply with applicable law."
    ],
    "blockers": [
      "Confirm ownership and licensing inventory for platform assets",
      "Define legally reviewed IP complaint and counter-notice process where applicable"
    ]
  },
  "third-party-services": {
    "id": "TP-001",
    "title": "Third-Party Services and External Links Policy",
    "purpose": "Clarifies that references to third parties require verification.",
    "body": [
      "External providers, professional services, identity services, payment providers, government registries and other integrations must be identified only where actually available. Providers operate independently unless a separate written agreement expressly states otherwise.",
      "Links, integrations and referrals do not guarantee availability, eligibility, quality, regulatory standing or outcomes. Review each provider's terms, fees and privacy notices. A listing, inquiry or discussion is not evidence of endorsement or a contracted relationship."
    ],
    "blockers": [
      "Inventory actual external services and data flows",
      "Verify provider relationships before describing any entity as a partner"
    ]
  },
  "partnerships": {
    "id": "PART-001",
    "title": "Partnership and Institutional Engagement Policy",
    "purpose": "Sets a careful framework for proposed partnerships and institutional inquiries.",
    "body": [
      "Partnership inquiries may help identify possible engagement with public institutions, export-promotion bodies, trade and investment agencies, chambers, professional associations, financial institutions, service providers, technology firms, academic or development organisations, sponsors and ecosystem partners.",
      "An inquiry or preliminary discussion does not create a partnership, agency, exclusivity, referral obligation, endorsement, funding commitment or authority to use another organisation's name or logo. Relationships require due diligence, authorised approval and the required executed written agreement.",
      "Confidential information should be shared only through an authorised workflow and under suitable agreements. Conflicts, referral arrangements, public announcements, branding and termination conditions require documented approval."
    ],
    "blockers": [
      "Approve due diligence, conflict, logo-use and announcement procedures",
      "Require executed agreements before publicly claiming a partnership"
    ]
  },
  "complaints": {
    "id": "COMP-001",
    "title": "Complaints and Dispute Resolution Policy",
    "purpose": "Explains complaint categories pending verified contacts and service targets.",
    "body": [
      "An approved process should route general service, account access, billing (if introduced), privacy, security, accessibility, misuse and partner-related complaints to an accountable reviewer. Acknowledgement and resolution targets will be published only when the organisation has approved them and can meet them operationally.",
      "Users retain applicable statutory and regulatory complaint rights. An internal route does not require a user to exhaust it before exercising a legal right unless a lawful and applicable requirement provides otherwise. Verified contact details are required before this policy can be activated."
    ],
    "blockers": [
      "Publish verified legal, privacy, support and security contacts",
      "Approve complaint triage, escalation, service targets and record retention"
    ]
  },
  "accessibility": {
    "id": "ACC-001",
    "title": "Accessibility Policy",
    "purpose": "States the accessibility engineering objective without claiming certification.",
    "body": [
      "PieroloOS aims to improve access through semantic page structure, keyboard operation, visible focus, readable text, responsive layouts, contrast, accessible forms and reduced-motion compatibility. The application should be assessed against WCAG 2.2 AA as an engineering target, alongside standards legally applicable to each market.",
      "This policy is not a certification or claim of full conformance. Users may raise accessibility issues through a verified contact channel once published; accommodation, prioritisation and remediation processes require operational approval."
    ],
    "blockers": [
      "Run and document keyboard, screen-reader and automated accessibility assessments",
      "Verify public journeys on mobile and with enlarged text",
      "Publish an accessible feedback channel"
    ]
  },
  "ai-and-automation": {
    "id": "AI-001",
    "title": "AI, Automation and Decision-Support Policy",
    "purpose": "Separates evidence from interpretations and records the current implementation boundary.",
    "body": [
      "The product documentation describes an explainability foundation but states that no AI model or persistence for AI output is currently wired end-to-end. Therefore this policy does not claim that production AI features are active.",
      "Where AI-assisted features are introduced, the platform should distinguish user-provided information, secondary-source information, primary-source information, information cross-verified against independent evidence, and AI-generated interpretation. Generated summaries, extracts or recommendations must not be presented as independent evidence or professional advice.",
      "Consequential outputs require source review, visible uncertainty and appropriate human oversight. Users should correct errors and report harmful or materially misleading outputs through a verified support route. Do not submit confidential material to an AI workflow unless the purpose, processing and safeguards have been disclosed and authorised."
    ],
    "blockers": [
      "Verify whether any AI provider or live model is deployed",
      "Document model/data flow, retention, source provenance, human review and incident process before activation"
    ]
  },
  "jurisdictional-notice": {
    "id": "JUR-001",
    "title": "Jurisdictional and Regulatory Notice",
    "purpose": "Explains jurisdictional limits and evidence requirements.",
    "body": [
      "Corporate formation, tax, licensing, reporting, beneficial ownership, foreign investment, banking, data protection and cross-border obligations differ by jurisdiction and by the facts of an entity or transaction.",
      "The product documentation states that no jurisdiction rule is presented as authoritative and seed jurisdiction records contain structure only. Important conclusions should therefore be checked against current primary sources and qualified local professionals. Assess source issuer, retrieval date, jurisdiction, scope, status and limitations before acting.",
      "Country coverage is not comprehensive by default. If material research is missing, stale or uncertain, treat the gap as unresolved rather than assuming the platform has identified every obligation or that a government authority will approve an action."
    ],
    "blockers": [
      "Build and verify an authoritative jurisdiction source registry before making coverage claims",
      "Document source update and review process",
      "Obtain jurisdiction-specific legal review for market-specific disclosures"
    ]
  }
} as const;

export function generateStaticParams() {
  return Object.keys(docs).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const doc = docs[slug as keyof typeof docs];
  if (!doc) return { robots: { index: false, follow: false } };
  return {
    ...publicPageMetadata(`/policies/${slug}`),
    title: { absolute: `${doc.title} — Draft | PieroloOS` },
    description: doc.purpose,
    robots: { index: false, follow: true },
  };
}

export default async function PolicyDocumentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = docs[slug as keyof typeof docs];
  if (!doc) notFound();
  return (
    <PublicShell>
      <section className="public-section legal-page" aria-labelledby="policy-title">
        <article className="public-container legal-document">
          <p className="eyebrow">POLICY DOCUMENT · DRAFT</p>
          <h1 id="policy-title" className="public-h2">{doc.title}</h1>
          <div className="legal-draft-notice" role="alert">
            <strong>DRAFT — NOT APPROVED FOR BINDING OR FINAL PUBLICATION.</strong>
            <p>This document is a draft for product, operational and, where required, qualified legal review. It is not evidence of legal compliance, certification, or a completed operational control.</p>
          </div>
          <dl className="policy-meta">
            <div><dt>Policy ID</dt><dd>{doc.id}</dd></div>
            <div><dt>Version</dt><dd>0.1-draft</dd></div>
            <div><dt>Status</dt><dd>DRAFT — REVIEW REQUIRED</dd></div>
            <div><dt>Effective date</dt><dd>Not assigned</dd></div>
          </dl>
          <p className="legal-prose">{doc.purpose}</p>
          {doc.body.map((paragraph) => <p className="legal-prose" key={paragraph}>{paragraph}</p>)}
          <section className="policy-blockers">
            <h2>Approval and implementation requirements</h2>
            <p>This readiness section is shown to make the draft status clear; it is not a binding contractual clause.</p>
            <ul>{doc.blockers.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>
          <p className="legal-related-links"><Link href="/policies">All Policies &amp; Legal</Link> · <Link href="/terms">Terms and Conditions (draft)</Link> · <Link href="/faq">FAQ</Link></p>
        </article>
      </section>
    </PublicShell>
  );
}
