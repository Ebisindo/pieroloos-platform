"use client";

import { useId, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { MessageKey } from "@/lib/i18n/messages";
import {
  PARTNERSHIP_INQUIRY_TYPES,
  PARTNERSHIP_MESSAGE_MAX,
} from "@/lib/partnerships/inquiry-options";

type FieldErrors = Partial<Record<string, string[]>>;
type Status = { kind: "idle" } | { kind: "submitting" } | { kind: "success" } | { kind: "error"; message: MessageKey };

export function PartnershipInquiryForm() {
  const { t } = useLocale();
  const uid = useId();
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [messageLength, setMessageLength] = useState(0);

  const id = (name: string) => `${uid}-${name}`;
  const errorProps = (name: string) => ({
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": errors[name] ? id(`${name}-error`) : undefined,
  });
  const fieldError = (name: string) =>
    errors[name] ? <p id={id(`${name}-error`)} className="form-error">{t("form.validation.invalid")}</p> : null;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setStatus({ kind: "submitting" });
    setErrors({});
    try {
      const response = await fetch("/api/partnerships/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partnerType: data.get("partnerType"),
          contactName: data.get("contactName"),
          email: data.get("email"),
          organisationName: data.get("organisationName"),
          websiteUrl: data.get("websiteUrl"),
          country: data.get("country"),
          message: data.get("message"),
          consent: data.get("consent") === "on",
          hp: data.get("hp") ?? "",
        }),
      });
      if (response.status === 201) {
        form.reset();
        setMessageLength(0);
        setStatus({ kind: "success" });
        return;
      }
      const payload = await response.json().catch(() => null) as { error?: string; issues?: FieldErrors } | null;
      if (response.status === 422 && payload?.issues) {
        setErrors(Object.fromEntries(Object.entries(payload.issues).map(([field, messages]) => [field, messages?.length ? [t("form.validation.invalid")] : []])));
        setStatus({ kind: "error", message: "form.error.correctFields" });
      } else if (response.status === 429) {
        setStatus({ kind: "error", message: "form.error.tooMany" });
      } else {
        setStatus({ kind: "error", message: "form.error.submit" });
      }
    } catch {
      setStatus({ kind: "error", message: "form.error.network" });
    }
  }

  if (status.kind === "success") {
    return (
      <div role="status" className="form-success">
        <h3>{t("form.success.title")}</h3>
        <p>{t("form.success.body")}</p>
        <button type="button" className="button button-secondary" onClick={() => setStatus({ kind: "idle" })}>
          {t("form.success.another")}
        </button>
      </div>
    );
  }

  const submitting = status.kind === "submitting";
  const typeLabelKeys = {
    PROFESSIONAL_SERVICES: "form.type.professional",
    TECHNOLOGY_PROVIDER: "form.type.technology",
    FINANCIAL_INSTITUTION: "form.type.financial",
    INSTITUTIONAL_PARTNER: "form.type.institutional",
    STRATEGIC_SPONSOR_INVESTOR: "form.type.sponsor",
    DISTRIBUTION_ECOSYSTEM: "form.type.distribution",
  } as const;

  return (
    <form onSubmit={onSubmit} noValidate aria-busy={submitting} className="inquiry-form">
      <div className="form-grid">
        <div className="form-field">
          <label htmlFor={id("partnerType")}>{t("form.partnerType")} <span aria-hidden="true">*</span></label>
          <select id={id("partnerType")} name="partnerType" required defaultValue="" className="form-input" {...errorProps("partnerType")}>
            <option value="" disabled>{t("form.categoryPlaceholder")}</option>
            {PARTNERSHIP_INQUIRY_TYPES.map((type) => (
              <option key={type} value={type}>{t(typeLabelKeys[type])}</option>
            ))}
          </select>
          {fieldError("partnerType")}
        </div>
        <div className="form-field">
          <label htmlFor={id("organisationName")}>{t("form.organisation")} <span aria-hidden="true">*</span></label>
          <input id={id("organisationName")} name="organisationName" required maxLength={160} autoComplete="organization" className="form-input" {...errorProps("organisationName")} />
          {fieldError("organisationName")}
        </div>
        <div className="form-field">
          <label htmlFor={id("contactName")}>{t("form.yourName")} <span aria-hidden="true">*</span></label>
          <input id={id("contactName")} name="contactName" required maxLength={120} autoComplete="name" className="form-input" {...errorProps("contactName")} />
          {fieldError("contactName")}
        </div>
        <div className="form-field">
          <label htmlFor={id("email")}>{t("form.email")} <span aria-hidden="true">*</span></label>
          <input id={id("email")} name="email" type="email" required maxLength={254} autoComplete="email" className="form-input" {...errorProps("email")} />
          {fieldError("email")}
        </div>
        <div className="form-field">
          <label htmlFor={id("websiteUrl")}>{t("form.website")}</label>
          <input id={id("websiteUrl")} name="websiteUrl" type="url" inputMode="url" maxLength={2048} placeholder="https://" autoComplete="url" className="form-input" {...errorProps("websiteUrl")} />
          {fieldError("websiteUrl")}
        </div>
        <div className="form-field">
          <label htmlFor={id("country")}>{t("form.country")}</label>
          <input id={id("country")} name="country" maxLength={80} autoComplete="country-name" className="form-input" {...errorProps("country")} />
          {fieldError("country")}
        </div>
      </div>

      <div className="form-field">
        <label htmlFor={id("message")}>{t("form.message")} <span aria-hidden="true">*</span></label>
        <textarea
          id={id("message")}
          name="message"
          required
          rows={6}
          maxLength={PARTNERSHIP_MESSAGE_MAX}
          onChange={(event) => setMessageLength(event.target.value.length)}
          className="form-input"
          {...errorProps("message")}
        />
        <p className="form-hint">{t("form.messageHint", { count: messageLength, max: PARTNERSHIP_MESSAGE_MAX })}</p>
        {fieldError("message")}
      </div>

      <div className="form-honeypot" aria-hidden="true">
        <label>{t("form.leaveEmpty")}<input name="hp" tabIndex={-1} autoComplete="off" /></label>
      </div>

      <div className="form-field">
        <label className="form-check">
          <input type="checkbox" name="consent" required {...errorProps("consent")} />
          <span>{t("form.consent")} <span aria-hidden="true">*</span></span>
        </label>
        {fieldError("consent")}
      </div>

      <p className="form-hint">{t("form.requiredNote")}</p>

      <div aria-live="assertive">
        {status.kind === "error" ? <p role="alert" className="form-error form-error-banner">{t(status.message)}</p> : null}
      </div>

      <button type="submit" className="button button-primary public-cta" disabled={submitting}>
        {submitting ? t("form.submitting") : t("form.submit")}
      </button>
    </form>
  );
}
