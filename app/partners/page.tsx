"use client";

import Link from "next/link";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { PublicShell } from "@/components/public/PublicShell";
import { PartnershipInquiryForm } from "@/components/public/PartnershipInquiryForm";
import type { MessageKey } from "@/lib/i18n/messages";

const categories = [
  { key: "professional", title: "partners.category.professional.title", audience: "partners.category.professional.audience", contribution: "partners.category.professional.contribution", value: "partners.category.professional.value" },
  { key: "technology", title: "partners.category.technology.title", audience: "partners.category.technology.audience", contribution: "partners.category.technology.contribution", value: "partners.category.technology.value" },
  { key: "financial", title: "partners.category.financial.title", audience: "partners.category.financial.audience", contribution: "partners.category.financial.contribution", value: "partners.category.financial.value" },
  { key: "institutional", title: "partners.category.institutional.title", audience: "partners.category.institutional.audience", contribution: "partners.category.institutional.contribution", value: "partners.category.institutional.value" },
  { key: "sponsor", title: "partners.category.sponsor.title", audience: "partners.category.sponsor.audience", contribution: "partners.category.sponsor.contribution", value: "partners.category.sponsor.value" },
  { key: "distribution", title: "partners.category.distribution.title", audience: "partners.category.distribution.audience", contribution: "partners.category.distribution.contribution", value: "partners.category.distribution.value" },
] as const satisfies readonly {
  key: string;
  title: MessageKey;
  audience: MessageKey;
  contribution: MessageKey;
  value: MessageKey;
}[];

const benefits = [
  "partners.benefits.0",
  "partners.benefits.1",
  "partners.benefits.2",
  "partners.benefits.3",
  "partners.benefits.4",
  "partners.benefits.5",
  "partners.benefits.6",
  "partners.benefits.7",
  "partners.benefits.8",
] as const satisfies readonly MessageKey[];

const phases = [
  { phase: "I", name: "partners.funding.phase1", range: "₦5M–₦8M" },
  { phase: "II", name: "partners.funding.phase2", range: "₦15M–₦22M" },
  { phase: "III", name: "partners.funding.phase3", range: "₦10M–₦15M" },
  { phase: "IV", name: "partners.funding.phase4", range: "₦10M–₦20M" },
] as const satisfies readonly { phase: string; name: MessageKey; range: string }[];

export default function PartnersPage() {
  const { t } = useLocale();
  return (
    <PublicShell>
      <section className="public-hero" aria-labelledby="partners-title">
        <div className="public-container public-hero-inner">
          <p className="eyebrow">{t("partners.eyebrow")}</p>
          <h1 id="partners-title" className="public-hero-title">
            {t("partners.hero.title")}
            <span className="public-hero-accent">{t("partners.hero.accent")}</span>
          </h1>
          <p className="public-lead">{t("partners.hero.description")}</p>
          <div className="public-cta-row">
            <Link href="#partner-with-us" className="button button-primary public-cta">{t("partners.hero.primaryAction")}</Link>
            <Link href="#categories" className="button button-secondary public-cta">{t("partners.hero.secondaryAction")}</Link>
          </div>
          <p className="public-note">{t("partners.hero.note")}</p>
        </div>
      </section>

      <section className="public-section" aria-labelledby="vision-title">
        <div className="public-container public-split">
          <div>
            <p className="eyebrow">{t("partners.vision.eyebrow")}</p>
            <h2 id="vision-title" className="public-h2">{t("partners.vision.title")}</h2>
          </div>
          <div className="public-prose">
            <h3 className="public-h3-inline">{t("partners.vision.heading")}</h3>
            <p>{t("partners.vision.body")}</p>
            <h3 className="public-h3-inline">{t("partners.mission.heading")}</h3>
            <p>{t("partners.mission.body")}</p>
          </div>
        </div>
      </section>

      <section id="categories" className="public-section" aria-labelledby="categories-title">
        <div className="public-container">
          <p className="eyebrow">{t("partners.categories.eyebrow")}</p>
          <h2 id="categories-title" className="public-h2">{t("partners.categories.title")}</h2>
          <p className="public-section-lead">{t("partners.categories.description")}</p>
          <ul className="capability-grid">
            {categories.map((item) => (
              <li key={item.key} className="glass-panel capability-card">
                <h3>{t(item.title)}</h3>
                <p className="partner-audience">{t(item.audience)}</p>
                <dl className="partner-details">
                  <dt>{t("partners.category.contribution")}</dt>
                  <dd>{t(item.contribution)}</dd>
                  <dt>{t("partners.category.value")}</dt>
                  <dd>{t(item.value)}</dd>
                </dl>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="public-section" aria-labelledby="benefits-title">
        <div className="public-container">
          <p className="eyebrow">{t("partners.benefits.eyebrow")}</p>
          <h2 id="benefits-title" className="public-h2">{t("partners.benefits.title")}</h2>
          <ul className="benefit-list">
            {benefits.map((key) => (
              <li key={key} className="glass-panel">{t(key)}</li>
            ))}
          </ul>
          <p className="public-note">{t("partners.benefits.note")}</p>
        </div>
      </section>

      <section id="funding" className="public-section" aria-labelledby="funding-title">
        <div className="public-container">
          <p className="eyebrow">{t("partners.funding.eyebrow")}</p>
          <h2 id="funding-title" className="public-h2">{t("partners.funding.title")}</h2>
          <p className="public-section-lead">{t("partners.funding.description")}</p>
          <div className="funding-summary">
            <div className="glass-panel funding-figure">
              <span className="funding-label">{t("partners.funding.programme")}</span>
              <strong>₦45 million–₦81 million</strong>
            </div>
            <div className="glass-panel funding-figure">
              <span className="funding-label">{t("partners.funding.target")}</span>
              <strong>₦60 million</strong>
            </div>
          </div>
          <div className="glass-panel funding-table-wrap">
            <table className="funding-table">
              <caption>{t("partners.funding.caption")}</caption>
              <thead>
                <tr>
                  <th scope="col">{t("partners.funding.phase")}</th>
                  <th scope="col">{t("partners.funding.focus")}</th>
                  <th scope="col">{t("partners.funding.range")}</th>
                </tr>
              </thead>
              <tbody>
                {phases.map((row) => (
                  <tr key={row.phase}>
                    <th scope="row">{t("partners.funding.phase")} {row.phase}</th>
                    <td>{t(row.name)}</td>
                    <td>{row.range}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="public-note">{t("partners.funding.note")}</p>
        </div>
      </section>

      <section id="partner-with-us" className="public-section" aria-labelledby="status-title">
        <div className="public-container">
          <div className="glass-panel public-cta-panel">
            <h2 id="status-title" className="public-h2">{t("partners.inquiry.title")}</h2>
            <p className="public-section-lead">{t("partners.inquiry.description")}</p>
            <PartnershipInquiryForm />
            <Link href="/" className="button button-secondary public-cta">{t("partners.back")}</Link>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
