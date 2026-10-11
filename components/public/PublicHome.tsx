import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { productModules } from "@/lib/navigation";

type Availability = "Available" | "Foundation" | "Planned";

const journey: { title: string; body: string; status: Availability; via: string }[] = [
  { title: "Define business intent", body: "Capture goals, activities, ownership and context through structured client intake.", status: "Available", via: "Client Intake" },
  { title: "Explore entity architecture", body: "Frame entity and structure options as considerations for professional review.", status: "Foundation", via: "Business Profile, Market Expansion" },
  { title: "Evaluate jurisdictions", body: "Compare jurisdictions with visible evidence quality, provenance and limitations.", status: "Foundation", via: "Jurisdiction Lens" },
  { title: "Assess relevant risks", body: "Surface readiness gaps and cross-border considerations as observations, not conclusions.", status: "Foundation", via: "Market readiness, Cross-border Preparation" },
  { title: "Build a formation roadmap", body: "Turn decisions into staged plans, tasks and evidence requirements.", status: "Foundation", via: "Formation Roadmap" },
  { title: "Organise compliance requirements", body: "Track obligations, owners, reminders and supporting evidence in one place.", status: "Foundation", via: "Compliance" },
  { title: "Escalate to qualified professionals", body: "Route matters to licensed advisers for review. A curated professional network is not yet live.", status: "Planned", via: "Advisor review workflows today; partner network planned" },
  { title: "Support ongoing administration", body: "Keep engagements, actions and notifications organised after formation.", status: "Foundation", via: "Engagements, Compliance, Reports" },
  { title: "Prepare for growth and expansion", body: "Plan new markets and cross-border structures with the same evidence discipline.", status: "Foundation", via: "Market Expansion, Cross-border Preparation" },
];

const planned = [
  { title: "Professional partner network", body: "Vetted professionals and a structured referral workflow. See the partnership page for status." },
  { title: "Self-serve subscriptions and billing", body: "Plan, entitlement and invoicing data structures exist; customer-facing billing does not." },
  { title: "AI-assisted analysis", body: "Explainability rules are defined; no AI analysis is offered to customers yet." },
];

const operationalOrFoundation = (status: string): Availability => (status === "operational" ? "Available" : "Foundation");

function StatusPill({ status }: { status: Availability }) {
  const tone = status === "Available" ? "status-success" : status === "Foundation" ? "status-info" : "status-neutral";
  return <span className={`status-badge ${tone}`}>{status}</span>;
}

export function PublicHome() {
  return (
    <>
      <section className="public-hero" aria-labelledby="hero-title">
        <div className="public-container public-hero-inner">
          <p className="eyebrow">BUSINESS INTELLIGENCE &amp; FORMATION PLATFORM</p>
          <h1 id="hero-title" className="public-hero-title">
            Build the right business.
            <span className="public-hero-accent">From idea to infrastructure.</span>
          </h1>
          <p className="public-lead">
            PieroloOS brings business intent, entity architecture, jurisdiction intelligence, compliance workflows and
            professional expertise into one structured platform.
          </p>
          <div className="public-cta-row">
            <Link href="/signin?callbackUrl=/clients/new" className="button button-primary public-cta">
              Start Your Business Journey <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link href="#journey" className="button button-secondary public-cta">Explore PieroloOS</Link>
          </div>
          <p className="public-note">Sign-in is required. PieroloOS supports human review and does not replace legal, tax or financial professionals.</p>
        </div>
      </section>

      <section id="journey" className="public-section" aria-labelledby="journey-title">
        <div className="public-container">
          <p className="eyebrow">THE JOURNEY</p>
          <h2 id="journey-title" className="public-h2">Nine steps from intent to infrastructure</h2>
          <p className="public-section-lead">Each step shows what exists in the platform today and what is still planned.</p>
          <ol className="journey-list">
            {journey.map((step, index) => (
              <li key={step.title} className="glass-panel journey-step">
                <span className="journey-index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <div className="journey-head">
                    <h3>{step.title}</h3>
                    <StatusPill status={step.status} />
                  </div>
                  <p>{step.body}</p>
                  <p className="journey-via">{step.via}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="capabilities" className="public-section" aria-labelledby="capabilities-title">
        <div className="public-container">
          <p className="eyebrow">CAPABILITIES</p>
          <h2 id="capabilities-title" className="public-h2">What the platform does today</h2>
          <p className="public-section-lead">
            <strong>Available</strong> modules are in use in the workspace. <strong>Foundation</strong> modules exist with core
            workflows but are still maturing.
          </p>
          <ul className="capability-grid">
            {productModules.map((module) => (
              <li key={module.key} className="glass-panel capability-card">
                <div className="journey-head">
                  <h3>{module.label}</h3>
                  <StatusPill status={operationalOrFoundation(module.status)} />
                </div>
              </li>
            ))}
          </ul>
          <h3 className="public-h3">Planned, not yet available</h3>
          <ul className="capability-grid">
            {planned.map((item) => (
              <li key={item.title} className="glass-panel capability-card">
                <div className="journey-head">
                  <h3>{item.title}</h3>
                  <StatusPill status="Planned" />
                </div>
                <p>{item.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="professionals" className="public-section" aria-labelledby="professionals-title">
        <div className="public-container public-split">
          <div>
            <p className="eyebrow">PROFESSIONAL ECOSYSTEM</p>
            <h2 id="professionals-title" className="public-h2">Software organises. Professionals decide.</h2>
          </div>
          <div className="public-prose">
            <p>
              Formation, tax and compliance decisions carry legal consequences. PieroloOS prepares drafts and analyses,
              tracks evidence and workflow, and keeps every decision with a qualified human reviewer.
            </p>
            <p>
              The intended ecosystem includes licensed lawyers, accountants, corporate service providers and other
              regulated specialists working inside shared, auditable workflows. That network is being designed; no
              partnerships are announced at this time.
            </p>
            <Link href="/partners" className="public-link">How partnership is planned <ArrowRight size={14} aria-hidden="true" /></Link>
          </div>
        </div>
      </section>

      <section className="public-section" aria-labelledby="partner-cta-title">
        <div className="public-container">
          <div className="glass-panel public-cta-panel">
            <h2 id="partner-cta-title" className="public-h2">Are you a professional serving founders?</h2>
            <p className="public-section-lead">Help shape how advisers and clients collaborate on formation and compliance.</p>
            <Link href="/partners#partner-with-us" className="button button-primary public-cta">Partner With Us</Link>
          </div>
        </div>
      </section>
    </>
  );
}
