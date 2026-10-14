import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell } from "@/components/public/PublicShell";
import { getRequestLocale } from "@/lib/i18n/request";
import { createTranslator } from "@/lib/i18n/messages";
import { getSiteUrl, publicPageMetadata } from "@/lib/site";

const faqSections = [
  { title: "About PieroloOS", items: [["What is PieroloOS?","PieroloOS is a business intelligence and formation platform designed to organise business information, prepare analyses and drafts, coordinate workflows, track evidence, and support human review across business formation, compliance preparation, and cross-border market expansion."],["Who is PieroloOS for?","It is designed for founders, business owners, companies exploring new markets, professional-service providers, and potential institutional or ecosystem partners. Available services and features may vary by release and access level."],["Does PieroloOS operate globally?","The platform is designed with a country-agnostic, globally scalable direction. Jurisdiction coverage and authoritative country-specific content are not complete by default. Review the evidence, source, date, coverage, and limitations shown for jurisdiction-specific information."],["Is PieroloOS a law firm, accounting firm, tax adviser, or financial adviser?","No. PieroloOS is software for decision support and workflow organisation. It does not replace qualified professionals, government agencies, business registries, or other competent authorities."]] },
  { title: "Formation, evidence and compliance", items: [["Can PieroloOS incorporate my company or guarantee registration?","No guarantee is made. The platform can help organise information, prepare a formation roadmap, and coordinate steps, documents, and reviews where those features are available. Filing, registration, and approval depend on the relevant authority, provider, applicable requirements, and facts of each case."],["Are jurisdiction comparisons legal or tax advice?","No. Comparisons are decision-support material, not a professional opinion or definitive recommendation. Verify important matters against current primary sources and obtain appropriate professional advice before acting."],["How does PieroloOS treat evidence?","The platform aims to distinguish user-provided information from secondary sources, primary sources, and cross-verified evidence. Review each source, retrieval date, jurisdiction, scope, confidence, and stated limitation. Missing or uncertain information must not be treated as a confirmed fact."],["Does a compliance checklist confirm that my company is compliant?","No. A checklist helps organise tasks and supporting evidence. It does not certify compliance or guarantee that every obligation has been identified."],["What should I do if information appears incorrect or outdated?","Do not rely on it for a consequential decision. Preserve the relevant source details and use an official PieroloOS support channel when one is available. Independently confirm urgent matters with the responsible authority or a qualified professional."]] },
  { title: "Accounts, privacy and documents", items: [["Do I need an account?","Some workflows require authentication and an authorised workspace or client-portal grant. Public pages may be accessible without signing in. Access remains subject to service availability, eligibility, and permission rules."],["Who can access my workspace or client documents?","Access should be limited by authentication, workspace membership, client-portal grants, and assigned permissions. Do not share credentials or upload information you are not authorised to provide."],["How should I submit confidential information?","Provide only information necessary for the intended purpose and only through an official, appropriately secured workflow. Do not include passwords, private keys, payment-card details, or unnecessary sensitive personal data in general enquiries. Review applicable notices first."],["Does PieroloOS guarantee uninterrupted availability or data recovery?","No. Availability, integrations, storage, and recovery depend on the deployed service and its operational controls. Retain your own lawful copies of important records."],["How does PieroloOS handle privacy and personal information?","The final privacy notice must reflect actual processing, storage, sharing, retention, deletion, cookies, processors, international transfers, user rights and verified contact details. Consult the Policies & Legal directory; do not infer that a draft notice represents a completed compliance assessment."],["Does PieroloOS use cookies?","The application documents a locale preference cookie. Other cookies and browser storage must be inventoried before a final cookie policy is approved. Where consent is required, the mechanism must store and respect your choice."],["Can I request account closure or deletion of my data?","Use a verified contact or process published by the operator when available. The timing and scope of deletion can depend on implemented workflows, backups, legal obligations and lawful retention exceptions; no immediate-deletion guarantee is made."]] },
  { title: "Pricing, partnerships and support", items: [["How much does PieroloOS cost?","Pricing, subscriptions, payment processing, and entitlements may not yet be available in every release. Treat a price as binding only when presented through an authorised, clearly documented offer or checkout."],["Does submitting a partnership inquiry create a partnership?","No. An inquiry expresses interest only. It creates no agreement, agency, exclusivity, referral obligation, or funding commitment. A partnership begins only after the required written agreement has been executed."],["How can I get help or report a security or accessibility concern?","Use a verified official contact or support channel published by PieroloOS when available. Do not send credentials, private keys, or personal records through public posts or general enquiry fields."],["How are FAQ answers updated?","Answers may change as the platform, services, policies, and supported jurisdictions evolve. The date shown on this page identifies this content revision. Verify consequential matters against authoritative sources and qualified professionals."],["Are all languages fully supported?","English is the source language. French, Portuguese and Spanish remain preview locales and have not been professionally reviewed for all content. Legal translations must receive appropriate linguistic and legal review before being treated as approved."],["Are subscriptions, checkout, or refunds available?","Product documentation currently records billing and entitlements as prepared, without an operational payment provider or customer-facing billing flow. Do not assume a subscription, purchase, cancellation, or refund flow exists unless an authorised live offer confirms it."],["Does PieroloOS use AI to make final legal or compliance decisions?","The current product documentation describes an explainability foundation but does not record a model and persistence flow wired end-to-end. Any future automated interpretation must be distinguished from evidence and must not be treated as professional advice or an independently verified fact."],["Where can I find the policies and Terms?","Use the Policies & Legal directory and the Terms and Conditions page. The Terms and policy pages on this implementation branch are prominently marked as drafts pending required product, operational and legal approvals."]] },
] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = createTranslator(await getRequestLocale());
  return {
    ...publicPageMetadata("/faq"),
    title: { absolute: t("metadata.faq.title") },
    description: t("metadata.faq.description"),
    openGraph: { title: t("metadata.faq.title"), description: t("metadata.faq.description"), type: "website" },
  };
}

export default async function FaqPage() {
  const locale = await getRequestLocale();
  const t = createTranslator(locale);
  const site = getSiteUrl();
  const questions = faqSections.flatMap((section) => section.items);
  const structuredData = site ? JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: questions.map(([question, answer]) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer },
    })),
  }).replace(/</g, "\\u003c") : null;

  return (
    <PublicShell>
      {structuredData ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData }} /> : null}
      <section className="public-section legal-page" aria-labelledby="faq-title">
        <div className="public-container legal-document">
          <p className="eyebrow">HELP CENTRE</p>
          <h1 id="faq-title" className="public-h2">Frequently Asked Questions &amp; Answers</h1>
          <p className="public-section-lead">Clear answers about PieroloOS, evidence, accounts, service availability and important limitations.</p>
          {faqSections.map((section) => (
            <section key={section.title} className="faq-section" aria-labelledby={section.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}>
              <h2 id={section.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()} className="public-h3-inline">{section.title}</h2>
              <div className="faq-list">
                {section.items.map(([question, answer]) => (
                  <details key={question} className="faq-item">
                    <summary>{question}</summary>
                    <p>{answer}</p>
                  </details>
                ))}
              </div>
            </section>
          ))}
          <p className="legal-related-links"><Link href="/terms">{t("navigation.terms" as never)}</Link> · <Link href="/policies">{t("navigation.policies" as never)}</Link></p>
          <p className="legal-updated">Last updated: 14 October 2026</p>
        </div>
      </section>
    </PublicShell>
  );
}
