import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell } from "@/components/public/PublicShell";
import { PartnershipInquiryForm } from "@/components/public/PartnershipInquiryForm";
import { publicPageMetadata } from "@/lib/site";

export const metadata: Metadata = {
  ...publicPageMetadata("/partners"),
  title: "Partners and Sponsors",
  description:
    "PieroloOS is inviting strategic partners, technology providers, professional firms, institutions and sponsors to help build business-formation infrastructure. Indicative planning figures only.",
  openGraph: {
    title: "Build the Infrastructure Behind Better Businesses | PieroloOS",
    description: "Partnership and sponsorship opportunities with PieroloOS. No partnerships or funding are confirmed.",
    type: "website",
  },
};

const categories = [
  {
    title: "Professional services",
    audience: "Law firms, accounting and tax practices, corporate service providers.",
    contribution: "Domain review of workflows, templates and jurisdiction content; qualified advice to founders.",
    value: "Visibility in a professional ecosystem and the possibility of qualified referrals.",
  },
  {
    title: "Technology providers",
    audience: "Identity, document, payments, data and infrastructure vendors.",
    contribution: "Integrations, APIs and technical expertise for secure, auditable workflows.",
    value: "Integration opportunities and co-development of connected formation tooling.",
  },
  {
    title: "Financial institutions",
    audience: "Banks, payment providers and business-finance firms.",
    contribution: "Insight into onboarding and account-opening requirements for new businesses.",
    value: "Early engagement with prepared, well-documented businesses, subject to your own onboarding standards.",
  },
  {
    title: "Institutional partners",
    audience: "Industry bodies, development organisations, academic and public-interest institutions.",
    contribution: "Research, standards alignment, educational reach and credibility.",
    value: "Co-created educational resources and a channel for thought leadership.",
  },
  {
    title: "Strategic sponsors and investors",
    audience: "Organisations and individuals willing to fund or underwrite platform development.",
    contribution: "Development funding and strategic guidance for the programme set out below.",
    value: "Founding-partner recognition and strategic networking. No financial return is promised.",
  },
  {
    title: "Distribution and ecosystem partners",
    audience: "Incubators, accelerators, communities and cross-border business networks.",
    contribution: "Access to founders and market knowledge across target regions.",
    value: "Cross-border business opportunities and a shared resource set for the founders you serve.",
  },
];

const benefits = [
  "Founding-partner recognition",
  "Professional ecosystem visibility",
  "Potential qualified referrals",
  "Integration opportunities",
  "Co-created educational resources",
  "Thought leadership",
  "Strategic networking",
  "Co-development opportunities",
  "Cross-border business opportunities",
];

const phases = [
  { phase: "Phase I", name: "Validation and Foundation", range: "₦5M–₦8M" },
  { phase: "Phase II", name: "Production MVP", range: "₦15M–₦22M" },
  { phase: "Phase III", name: "Pilot and Market Launch", range: "₦10M–₦15M" },
  { phase: "Phase IV", name: "Expansion", range: "₦10M–₦20M" },
];

export default function PartnersPage() {
  return (
    <PublicShell>
      <section className="public-hero" aria-labelledby="partners-title">
        <div className="public-container public-hero-inner">
          <p className="eyebrow">PARTNERS AND SPONSORS</p>
          <h1 id="partners-title" className="public-hero-title">
            Build the Infrastructure
            <span className="public-hero-accent">Behind Better Businesses.</span>
          </h1>
          <p className="public-lead">
            PieroloOS is inviting strategic partners, technology providers, professional firms, institutions and sponsors to
            help build the next generation of business-formation infrastructure.
          </p>
          <div className="public-cta-row">
            <Link href="#partner-with-us" className="button button-primary public-cta">Partner With Us</Link>
            <Link href="#categories" className="button button-secondary public-cta">View partner categories</Link>
          </div>
          <p className="public-note">
            No partnerships, sponsorships or funding have been confirmed. Nothing on this page is an offer of securities or a
            commitment of any kind.
          </p>
        </div>
      </section>

      <section className="public-section" aria-labelledby="vision-title">
        <div className="public-container public-split">
          <div>
            <p className="eyebrow">VISION AND MISSION</p>
            <h2 id="vision-title" className="public-h2">Trusted infrastructure for business formation</h2>
          </div>
          <div className="public-prose">
            <h3 className="public-h3-inline">Vision</h3>
            <p>
              To build trusted digital infrastructure that makes business formation, corporate structuring, compliance and
              market expansion more intelligent, accessible and connected across Africa and eventually global emerging markets.
            </p>
            <h3 className="public-h3-inline">Mission</h3>
            <p>
              To simplify complex business-formation and corporate decisions by combining structured intelligence,
              jurisdiction analysis, workflow automation, compliance visibility and professional expertise within one trusted
              digital platform.
            </p>
          </div>
        </div>
      </section>

      <section id="categories" className="public-section" aria-labelledby="categories-title">
        <div className="public-container">
          <p className="eyebrow">WHO WE ARE LOOKING FOR</p>
          <h2 id="categories-title" className="public-h2">Six ways to take part</h2>
          <p className="public-section-lead">
            Each category describes a possible contribution and the value of taking part. These are invitations to discuss, not
            existing arrangements.
          </p>
          <ul className="capability-grid">
            {categories.map((item) => (
              <li key={item.title} className="glass-panel capability-card">
                <h3>{item.title}</h3>
                <p className="partner-audience">{item.audience}</p>
                <dl className="partner-details">
                  <dt>Possible contribution</dt>
                  <dd>{item.contribution}</dd>
                  <dt>Potential value</dt>
                  <dd>{item.value}</dd>
                </dl>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="public-section" aria-labelledby="benefits-title">
        <div className="public-container">
          <p className="eyebrow">POTENTIAL BENEFITS</p>
          <h2 id="benefits-title" className="public-h2">What participation could offer</h2>
          <ul className="benefit-list">
            {benefits.map((benefit) => (
              <li key={benefit} className="glass-panel">{benefit}</li>
            ))}
          </ul>
          <p className="public-note">
            Benefits are potential and depend on the arrangement agreed with each party. PieroloOS does not guarantee referrals,
            revenue, customers, or regulatory or commercial outcomes.
          </p>
        </div>
      </section>

      <section id="funding" className="public-section" aria-labelledby="funding-title">
        <div className="public-container">
          <p className="eyebrow">PROPOSED DEVELOPMENT PROGRAMME</p>
          <h2 id="funding-title" className="public-h2">Indicative funding plan</h2>
          <p className="public-section-lead">
            Planning estimates only. They are not verified quotations, not commitments, and no funding has been secured.
          </p>
          <div className="funding-summary">
            <div className="glass-panel funding-figure">
              <span className="funding-label">Indicative development programme</span>
              <strong>₦45 million–₦81 million</strong>
            </div>
            <div className="glass-panel funding-figure">
              <span className="funding-label">Indicative strategic development target (proposed)</span>
              <strong>₦60 million</strong>
            </div>
          </div>
          <div className="glass-panel funding-table-wrap">
            <table className="funding-table">
              <caption>Indicative cost range by phase (planning estimates, Nigerian naira)</caption>
              <thead>
                <tr>
                  <th scope="col">Phase</th>
                  <th scope="col">Focus</th>
                  <th scope="col">Indicative range</th>
                </tr>
              </thead>
              <tbody>
                {phases.map((row) => (
                  <tr key={row.phase}>
                    <th scope="row">{row.phase}</th>
                    <td>{row.name}</td>
                    <td>{row.range}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="public-note">
            The phase ranges are independent planning estimates and do not yet reconcile to the programme range above. A
            detailed budget, delivery schedule, staffing assumptions and measurable milestones must be prepared before any
            formal investment discussion.
          </p>
        </div>
      </section>

      <section id="partner-with-us" className="public-section" aria-labelledby="status-title">
        <div className="public-container">
          <div className="glass-panel public-cta-panel">
            <h2 id="status-title" className="public-h2">Send a partnership inquiry</h2>
            <p className="public-section-lead">
              The partner programme is in design. Applications, a professional directory and referral workflows are not yet
              available, and no organisation has agreed to participate. Inquiries are stored privately and reviewed manually.
              Submitting one does not create a partnership, and a response is not guaranteed.
            </p>
            <PartnershipInquiryForm />
            <Link href="/" className="button button-secondary public-cta">Back to PieroloOS</Link>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
