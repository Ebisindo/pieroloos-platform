"use client";

import { useId, useState } from "react";
import {
  PARTNERSHIP_INQUIRY_TYPES,
  PARTNERSHIP_INQUIRY_TYPE_LABELS,
  PARTNERSHIP_MESSAGE_MAX,
} from "@/lib/partnerships/inquiry-options";

type FieldErrors = Partial<Record<string, string[]>>;
type Status = { kind: "idle" } | { kind: "submitting" } | { kind: "success" } | { kind: "error"; message: string };

export function PartnershipInquiryForm() {
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
    errors[name] ? <p id={id(`${name}-error`)} className="form-error">{errors[name]?.[0]}</p> : null;

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
        setErrors(payload.issues);
        setStatus({ kind: "error", message: "Please correct the highlighted fields." });
      } else if (response.status === 429) {
        setStatus({ kind: "error", message: "Too many submissions. Please try again later." });
      } else {
        setStatus({ kind: "error", message: "We could not submit your inquiry. Please try again later." });
      }
    } catch {
      setStatus({ kind: "error", message: "Network error. Your inquiry was not sent; please try again." });
    }
  }

  if (status.kind === "success") {
    return (
      <div role="status" className="form-success">
        <h3>Inquiry received</h3>
        <p>
          Thank you. Your inquiry has been recorded for manual review. This is not an agreement or partnership, and a reply
          is not guaranteed.
        </p>
        <button type="button" className="button button-secondary" onClick={() => setStatus({ kind: "idle" })}>
          Submit another inquiry
        </button>
      </div>
    );
  }

  const submitting = status.kind === "submitting";

  return (
    <form onSubmit={onSubmit} noValidate aria-busy={submitting} className="inquiry-form">
      <div className="form-grid">
        <div className="form-field">
          <label htmlFor={id("partnerType")}>Partner type <span aria-hidden="true">*</span></label>
          <select id={id("partnerType")} name="partnerType" required defaultValue="" className="form-input" {...errorProps("partnerType")}>
            <option value="" disabled>Select a category</option>
            {PARTNERSHIP_INQUIRY_TYPES.map((type) => (
              <option key={type} value={type}>{PARTNERSHIP_INQUIRY_TYPE_LABELS[type]}</option>
            ))}
          </select>
          {fieldError("partnerType")}
        </div>
        <div className="form-field">
          <label htmlFor={id("organisationName")}>Organisation <span aria-hidden="true">*</span></label>
          <input id={id("organisationName")} name="organisationName" required maxLength={160} autoComplete="organization" className="form-input" {...errorProps("organisationName")} />
          {fieldError("organisationName")}
        </div>
        <div className="form-field">
          <label htmlFor={id("contactName")}>Your name <span aria-hidden="true">*</span></label>
          <input id={id("contactName")} name="contactName" required maxLength={120} autoComplete="name" className="form-input" {...errorProps("contactName")} />
          {fieldError("contactName")}
        </div>
        <div className="form-field">
          <label htmlFor={id("email")}>Email <span aria-hidden="true">*</span></label>
          <input id={id("email")} name="email" type="email" required maxLength={254} autoComplete="email" className="form-input" {...errorProps("email")} />
          {fieldError("email")}
        </div>
        <div className="form-field">
          <label htmlFor={id("websiteUrl")}>Website (optional)</label>
          <input id={id("websiteUrl")} name="websiteUrl" type="url" inputMode="url" maxLength={2048} placeholder="https://" autoComplete="url" className="form-input" {...errorProps("websiteUrl")} />
          {fieldError("websiteUrl")}
        </div>
        <div className="form-field">
          <label htmlFor={id("country")}>Country (optional)</label>
          <input id={id("country")} name="country" maxLength={80} autoComplete="country-name" className="form-input" {...errorProps("country")} />
          {fieldError("country")}
        </div>
      </div>

      <div className="form-field">
        <label htmlFor={id("message")}>How would you like to take part? <span aria-hidden="true">*</span></label>
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
        <p className="form-hint">{messageLength} / {PARTNERSHIP_MESSAGE_MAX}. Do not include confidential or personal data beyond what is needed.</p>
        {fieldError("message")}
      </div>

      <div className="form-honeypot" aria-hidden="true">
        <label>Leave this field empty<input name="hp" tabIndex={-1} autoComplete="off" /></label>
      </div>

      <div className="form-field">
        <label className="form-check">
          <input type="checkbox" name="consent" required {...errorProps("consent")} />
          <span>I agree that PieroloOS may store this inquiry and contact me about it. <span aria-hidden="true">*</span></span>
        </label>
        {fieldError("consent")}
      </div>

      <p className="form-hint">Fields marked * are required. Submitting an inquiry does not create a partnership or any commitment.</p>

      <div aria-live="assertive">
        {status.kind === "error" ? <p role="alert" className="form-error form-error-banner">{status.message}</p> : null}
      </div>

      <button type="submit" className="button button-primary public-cta" disabled={submitting}>
        {submitting ? "Submitting…" : "Submit inquiry"}
      </button>
    </form>
  );
}
