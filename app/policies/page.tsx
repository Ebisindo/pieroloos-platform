import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell } from "@/components/public/PublicShell";
import { getRequestLocale } from "@/lib/i18n/request";
import { createTranslator } from "@/lib/i18n/messages";
import { publicPageMetadata } from "@/lib/site";

const policyGroups = [
  { name: "Privacy and Data Protection", items: [
    ["Privacy Policy", "/policies/privacy", "PRIV-001", "DRAFT", "Personal information, data processing, user rights, retention and transfers."],
    ["Cookie Policy", "/policies/cookies", "COOK-001", "DRAFT", "Cookies and similar technologies; requires an actual browser-storage audit."],
    ["Data Retention and Deletion Policy", "/policies/data-retention", "RET-001", "DRAFT", "Retention schedules, account closure and lawful deletion exceptions."],
    ["Data Processing and Subprocessor Policy", "/policies/data-processing", "DPA-001", "DRAFT", "Controller/processor roles, subprocessors and data-processing agreements."],
  ]},
  { name: "Security and Responsible Use", items: [
    ["Acceptable Use Policy", "/policies/acceptable-use", "AUP-001", "DRAFT", "Authorised use, prohibited conduct and reporting."],
    ["Information Security Policy", "/policies/security", "SEC-001", "DRAFT", "Verified safeguards, incident handling and responsible disclosure."],
  ]},
  { name: "Terms, Subscriptions and Payments", items: [
    ["Terms and Conditions", "/terms", "TERMS-001", "DRAFT — LEGAL REVIEW REQUIRED", "Proposed platform terms; not approved for binding publication."],
    ["Subscriber Terms and Subscription Policy", "/policies/subscription", "SUB-001", "AVAILABILITY NOTICE", "Billing and entitlements are not recorded as customer-ready."],
    ["Billing Policy", "/policies/billing", "BILL-001", "AVAILABILITY NOTICE", "No payment provider or customer-facing billing flow is documented as operational."],
    ["Refund, Cancellation and Withdrawal Policy", "/policies/refunds-cancellations", "REF-001", "DRAFT", "Future purchase disclosures must preserve mandatory consumer rights."],
  ]},
  { name: "Intellectual Property and Third Parties", items: [
    ["Intellectual Property Policy", "/policies/intellectual-property", "IP-001", "DRAFT", "Platform materials, user content and third-party rights."],
    ["Third-Party Services Policy", "/policies/third-party-services", "TP-001", "DRAFT", "External providers, links, integrations and independent decisions."],
  ]},
  { name: "Partnerships and Institutional Relationships", items: [
    ["Partnership and Institutional Engagement Policy", "/policies/partnerships", "PART-001", "DRAFT", "Due diligence, authorised representatives, branding and written agreements."],
  ]},
  { name: "Complaints and Support", items: [
    ["Complaints and Dispute Resolution Policy", "/policies/complaints", "COMP-001", "DRAFT", "Complaint handling, escalation and statutory rights."],
  ]},
  { name: "Accessibility and Responsible Automation", items: [
    ["Accessibility Policy", "/policies/accessibility", "ACC-001", "DRAFT", "Accessibility goals; WCAG 2.2 AA is an engineering target, not a certification claim."],
    ["AI, Automation and Decision-Support Policy", "/policies/ai-and-automation", "AI-001", "DRAFT", "Separating source-backed evidence from automated interpretations."],
  ]},
  { name: "Jurisdictional and Regulatory Notices", items: [
    ["Jurisdictional and Regulatory Notice", "/policies/jurisdictional-notice", "JUR-001", "DRAFT", "Jurisdiction coverage, source dates, limitations and professional verification."],
  ]},
] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = createTranslator(await getRequestLocale());
  return {
    ...publicPageMetadata("/policies"),
    robots: { index: false, follow: true },
    title: { absolute: t("metadata.policies.title") },
    description: t("metadata.policies.description"),
    openGraph: { title: t("metadata.policies.title"), description: t("metadata.policies.description"), type: "website" },
  };
}

export default async function PoliciesPage() {
  const t = createTranslator(await getRequestLocale());
  return (
    <PublicShell>
      <section className="public-section legal-page" aria-labelledby="policies-title">
        <div className="public-container legal-document">
          <p className="eyebrow">TRUST · TRANSPARENCY · GOVERNANCE</p>
          <h1 id="policies-title" className="public-h2">Policies &amp; Legal</h1>
          <p className="public-section-lead">Browse current public information about PieroloOS policies. Each item below is presently a draft or availability notice; no item on this directory is represented as legally approved or binding.</p>
          <div className="legal-draft-notice" role="status">
            <strong>Publication status: DRAFTS AND NOTICES ONLY</strong>
            <p>These documents are a governance and implementation foundation. Approval requires verification of actual product behaviour, operational details, and any required qualified legal review.</p>
          </div>
          {policyGroups.map((group) => (
            <section key={group.name} className="policy-group" aria-labelledby={group.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}>
              <h2 id={group.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}>{group.name}</h2>
              <div className="policy-directory-list">
                {group.items.map(([title, href, id, status, summary]) => (
                  <article className="policy-directory-card" key={id}>
                    <div className="policy-directory-heading">
                      <h3><Link href={href}>{title}</Link></h3>
                      <span className="policy-status">{status}</span>
                    </div>
                    <p>{summary}</p>
                    <p className="policy-meta-inline"><span>{id}</span> · <span>Version 0.1-draft</span> · <span>Effective date not assigned</span></p>
                  </article>
                ))}
              </div>
            </section>
          ))}
          <p className="legal-related-links"><Link href="/faq">{t("navigation.faq" as never)}</Link> · <Link href="/terms">{t("navigation.terms" as never)}</Link></p>
          <p className="legal-language-note" role="note">{t("language.legalReviewNotice" as never)}</p>
        </div>
      </section>
    </PublicShell>
  );
}
