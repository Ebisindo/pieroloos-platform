"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { MessageKey } from "@/lib/i18n/messages";
import { productModules } from "@/lib/navigation";

type Availability = "Available" | "Foundation" | "Planned";

const journey = [
  { key: "intent", title: "home.journey.intent.title", body: "home.journey.intent.body", via: "home.journey.intent.via", status: "Available" },
  { key: "entity", title: "home.journey.entity.title", body: "home.journey.entity.body", via: "home.journey.entity.via", status: "Foundation" },
  { key: "jurisdiction", title: "home.journey.jurisdiction.title", body: "home.journey.jurisdiction.body", via: "home.journey.jurisdiction.via", status: "Foundation" },
  { key: "risks", title: "home.journey.risks.title", body: "home.journey.risks.body", via: "home.journey.risks.via", status: "Foundation" },
  { key: "roadmap", title: "home.journey.roadmap.title", body: "home.journey.roadmap.body", via: "home.journey.roadmap.via", status: "Foundation" },
  { key: "compliance", title: "home.journey.compliance.title", body: "home.journey.compliance.body", via: "home.journey.compliance.via", status: "Foundation" },
  { key: "professionals", title: "home.journey.professionals.title", body: "home.journey.professionals.body", via: "home.journey.professionals.via", status: "Planned" },
  { key: "administration", title: "home.journey.administration.title", body: "home.journey.administration.body", via: "home.journey.administration.via", status: "Foundation" },
  { key: "growth", title: "home.journey.growth.title", body: "home.journey.growth.body", via: "home.journey.growth.via", status: "Foundation" },
] as const satisfies readonly { key: string; title: MessageKey; body: MessageKey; via: MessageKey; status: Availability }[];

const planned = [
  { key: "partner", title: "home.planned.partner.title", body: "home.planned.partner.body" },
  { key: "billing", title: "home.planned.billing.title", body: "home.planned.billing.body" },
  { key: "ai", title: "home.planned.ai.title", body: "home.planned.ai.body" },
] as const satisfies readonly { key: string; title: MessageKey; body: MessageKey }[];

const operationalOrFoundation = (status: string): Availability => (status === "operational" ? "Available" : "Foundation");

const moduleLabels = {
  clients: "module.clientIntake",
  "business-profile": "module.businessProfile",
  jurisdiction: "module.jurisdictionLens",
  expansion: "module.marketExpansion",
  "cross-border": "module.crossBorder",
  formation: "module.formationRoadmap",
  compliance: "module.compliance",
  reports: "module.reportGenerator",
  engagements: "module.engagementRecords",
} as const;

function StatusPill({ status }: { status: Availability }) {
  const { t } = useLocale();
  const tone = status === "Available" ? "status-success" : status === "Foundation" ? "status-info" : "status-neutral";
  const key = status === "Available" ? "status.available" : status === "Foundation" ? "status.foundation" : "status.planned";
  return <span className={`status-badge ${tone}`}>{t(key)}</span>;
}

export function PublicHome() {
  const { t } = useLocale();
  return (
    <>
      <section className="public-hero" aria-labelledby="hero-title">
        <div className="public-container public-hero-inner">
          <p className="eyebrow">{t("home.eyebrow")}</p>
          <h1 id="hero-title" className="public-hero-title">
            {t("home.hero.title")}
            <span className="public-hero-accent">{t("home.hero.accent")}</span>
          </h1>
          <p className="public-lead">{t("home.hero.description")}</p>
          <div className="public-cta-row">
            <Link href="/signin?callbackUrl=/clients/new" className="button button-primary public-cta">
              {t("home.hero.primaryAction")} <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link href="#journey" className="button button-secondary public-cta">{t("home.hero.secondaryAction")}</Link>
          </div>
          <p className="public-note">{t("home.hero.note")}</p>
        </div>
      </section>

      <section id="journey" className="public-section" aria-labelledby="journey-title">
        <div className="public-container">
          <p className="eyebrow">{t("home.journey.eyebrow")}</p>
          <h2 id="journey-title" className="public-h2">{t("home.journey.title")}</h2>
          <p className="public-section-lead">{t("home.journey.description")}</p>
          <ol className="journey-list">
            {journey.map((step, index) => (
              <li key={step.key} className="glass-panel journey-step">
                <span className="journey-index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <div className="journey-head">
                    <h3>{t(step.title)}</h3>
                    <StatusPill status={step.status} />
                  </div>
                  <p>{t(step.body)}</p>
                  <p className="journey-via">{t(step.via)}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="capabilities" className="public-section" aria-labelledby="capabilities-title">
        <div className="public-container">
          <p className="eyebrow">{t("home.capabilities.eyebrow")}</p>
          <h2 id="capabilities-title" className="public-h2">{t("home.capabilities.title")}</h2>
          <p className="public-section-lead">{t("home.capabilities.description")}</p>
          <ul className="capability-grid">
            {productModules.map((module) => (
              <li key={module.key} className="glass-panel capability-card">
                <div className="journey-head">
                  <h3>{t(moduleLabels[module.key])}</h3>
                  <StatusPill status={operationalOrFoundation(module.status)} />
                </div>
              </li>
            ))}
          </ul>
          <h3 className="public-h3">{t("home.capabilities.plannedTitle")}</h3>
          <ul className="capability-grid">
            {planned.map((item) => (
              <li key={item.key} className="glass-panel capability-card">
                <div className="journey-head">
                  <h3>{t(item.title)}</h3>
                  <StatusPill status="Planned" />
                </div>
                <p>{t(item.body)}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="professionals" className="public-section" aria-labelledby="professionals-title">
        <div className="public-container public-split">
          <div>
            <p className="eyebrow">{t("home.professionals.eyebrow")}</p>
            <h2 id="professionals-title" className="public-h2">{t("home.professionals.title")}</h2>
          </div>
          <div className="public-prose">
            <p>{t("home.professionals.body")}</p>
            <p>{t("home.professionals.network")}</p>
            <Link href="/partners" className="public-link">{t("home.professionals.link")} <ArrowRight size={14} aria-hidden="true" /></Link>
          </div>
        </div>
      </section>

      <section className="public-section" aria-labelledby="partner-cta-title">
        <div className="public-container">
          <div className="glass-panel public-cta-panel">
            <h2 id="partner-cta-title" className="public-h2">{t("home.partner.title")}</h2>
            <p className="public-section-lead">{t("home.partner.body")}</p>
            <Link href="/partners#partner-with-us" className="button button-primary public-cta">{t("partners.hero.primaryAction")}</Link>
          </div>
        </div>
      </section>
    </>
  );
}
