import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell } from "@/components/public/PublicShell";
import { getRequestLocale } from "@/lib/i18n/request";
import { createTranslator } from "@/lib/i18n/messages";
import { publicPageMetadata } from "@/lib/site";

const termsSections = [
  ["1. Definitions and scope", "“Platform” means PieroloOS and the public or authenticated software features actually made available by its operator. “User” means a person or organisation accessing the Platform. “User Content” means information and materials a User submits. “Professional” means an independent qualified service provider. These draft Terms must be read with any applicable order form or signed service agreement. The relationship between documents must be resolved under the applicable signed agreement and mandatory law."],
  ["2. Nature and limitations of the Platform", "PieroloOS organises business information, drafts, analyses, evidence and workflows for decision support and human review. It is not a law firm, accounting firm, tax practice, financial or investment adviser, bank, insurer, government agency, business registry or regulatory authority. It does not guarantee incorporation, registration, regulatory or banking approval, tax or compliance outcomes, funding, market entry or commercial results. Important outputs require independent verification and, where appropriate, professional advice."],
  ["3. Eligibility and accounts", "A User must have legal capacity to use the Platform, provide accurate account information, and have authority to act for any represented organisation. Users are responsible for safeguarding credentials, promptly reporting suspected compromise and using only workspaces and records for which they are authorised. Verification or access may be limited, suspended or withdrawn where justified and lawful."],
  ["4. Acceptable use", "Users must not use the Platform unlawfully; commit fraud or impersonation; access accounts, workspaces, records or APIs without authority; evade security controls; introduce malicious code; infringe rights; misuse another person's information; manipulate records or audit trails; abuse automated requests; scrape protected information without authority; or submit passwords, private keys, payment-card data or other secrets through inappropriate forms."],
  ["5. User Content", "Users retain the rights they lawfully hold in User Content. To operate or support a service requested by the User and comply with law, the User grants the operator a limited, non-exclusive licence to host, reproduce, process and display that content only as necessary for those purposes. Users must have the rights, permissions and lawful basis required to submit content, including information about other people."],
  ["6. Privacy and security", "Use of the Platform is subject to the applicable privacy notice, which must accurately describe actual data categories, purposes, lawful bases where applicable, recipients and subprocessors, retention and deletion, cookies, international transfers, user rights and verified privacy contacts. No service should be represented as completely secure. Missing or unverified operational disclosures are blockers to activating final Terms."],
  ["7. Professionals and third parties", "Third-party providers operate independently unless a separate written agreement expressly states otherwise. Referrals, directory entries, integrations and external links do not guarantee a provider's availability, quality, eligibility, suitability or outcome. Users should review the provider's own terms, fees, credentials and privacy practices before engaging."],
  ["8. Fees, subscriptions and payments", "No price, subscription, billing cycle, renewal, payment method, tax treatment or entitlement is created by this draft. The product documentation currently records billing and entitlements as prepared, without a payment provider or customer-facing billing flow. Before any supported purchase, the authorised offer or checkout must clearly disclose price, currency, taxes, billing period, renewals, payment provider, cancellation terms and refunds."],
  ["9. Intellectual property", "The operator or its licensors retain rights in Platform software, original platform materials and brand assets to the extent protected by law. User Content remains subject to the User's rights as stated above. Third-party materials remain subject to their applicable rights and licences. No implied licence to use a name, logo or mark as an endorsement is granted."],
  ["10. Availability, changes and termination", "Features may change as the Platform develops. Roadmaps, prototypes, foundation capabilities and previews do not guarantee delivery or uninterrupted access. Account closure, data export, deletion and retention must follow the actual implemented processes, applicable privacy notice and mandatory law; these draft Terms do not promise immediate deletion or a particular recovery outcome."],
  ["11. Disclaimers", "The Platform and information are provided for workflow organisation and decision support. Users must verify consequential information against current primary sources and qualified professionals. Any final disclaimer is subject to applicable law and must preserve consumer protections, statutory guarantees and rights that cannot lawfully be excluded."],
  ["12. Liability", "No liability cap or blanket exclusion is established by this draft. Any final allocation of liability, exclusions, limits or indemnities requires qualified legal review for the operator and intended markets and must preserve liability that cannot lawfully be excluded."],
  ["13. Changes to Terms", "The final Terms must show an approved version and effective date. Material changes should be communicated, and affirmative consent must be captured whenever required by law or the applicable contract. Opening a link or inferred continued use is not an acceptance record where express consent is required."],
  ["14. Governing law and disputes", "Governing law, forum, dispute resolution and any mandatory consumer protections remain to be confirmed after the operating entity, intended markets and applicable laws are verified. No governing law or dispute forum is selected by this draft."],
  ["15. Complaints and contact", "Before publication, the operator must provide verified legal and support contact details and an operational complaint process. Do not send credentials, private keys or unnecessary sensitive information through general enquiry forms. Missing verified contacts are a publication blocker."],
  ["16. General provisions", "Subject to mandatory law, final Terms may address severability, waiver, assignment and the relationship between these Terms and any applicable signed agreement. These provisions are not final or binding until the document has passed the required legal and product approvals."],
] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = createTranslator(await getRequestLocale());
  return {
    ...publicPageMetadata("/terms"),
    robots: { index: false, follow: true },
    title: { absolute: t("metadata.terms.title") },
    description: t("metadata.terms.description"),
    openGraph: { title: t("metadata.terms.title"), description: t("metadata.terms.description"), type: "website" },
  };
}

export default async function TermsPage() {
  const locale = await getRequestLocale();
  const t = createTranslator(locale);
  return (
    <PublicShell>
      <section className="public-section legal-page" aria-labelledby="terms-title">
        <article className="public-container legal-document">
          <p className="eyebrow">{t("terms.draftLabel" as never)}</p>
          <h1 id="terms-title" className="public-h2">{t("terms.heading" as never)}</h1>
          <div className="legal-draft-notice" role="alert">
            <strong>{t("terms.draftNoticeTitle" as never)}</strong>
            <p>{t("terms.draftNoticeBody" as never)}</p>
          </div>
          <p className="legal-prose">Document status: <strong>DRAFT / NOT APPROVED</strong>. No effective date has been assigned. This text is an implementation draft for review, not a representation that binding Terms are currently in force.</p>
          {termsSections.map(([title, body]) => (
            <section key={title} className="legal-clause">
              <h2>{title}</h2>
              <p>{body}</p>
            </section>
          ))}
          <section className="legal-clause">
            <h2>Publication status and language</h2>
            <p>These Terms have not been approved for binding publication. English is the source-language draft. French, Portuguese and Spanish content is in preview and has not received professional legal translation review. Do not rely on any translation as an approved legal version.</p>
          </section>
          <p className="legal-related-links"><Link href="/faq">{t("navigation.faq" as never)}</Link> · <Link href="/policies">{t("navigation.policies" as never)}</Link></p>
        </article>
      </section>
    </PublicShell>
  );
}
