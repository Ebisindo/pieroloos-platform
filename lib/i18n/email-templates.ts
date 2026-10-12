import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n/config";
import { createTranslator, type MessageKey } from "@/lib/i18n/messages";

export type EmailTemplateParams = Record<string, string | number>;

// Only templates listed here are localized; anything else keeps its stored English subject and body.
const TEMPLATES: Record<string, { subject: MessageKey; body: MessageKey; params: readonly string[] }> = {
  "operational-action-escalation": {
    subject: "email.escalation.subject",
    body: "email.escalation.body",
    params: ["title", "level"],
  },
};

export function resolveEmailLocale(value: string | null | undefined): Locale {
  return value && isLocale(value) ? value : DEFAULT_LOCALE;
}

// Stored JSON is untrusted at render time: keep only the expected primitive parameters.
export function parseEmailTemplateParams(templateKey: string, raw: unknown): EmailTemplateParams | null {
  const template = TEMPLATES[templateKey];
  if (!template || !raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const params: EmailTemplateParams = {};
  for (const name of template.params) {
    const value = (raw as Record<string, unknown>)[name];
    if (typeof value !== "string" && typeof value !== "number") return null;
    params[name] = value;
  }
  return params;
}

export function renderLocalizedEmailText(
  templateKey: string,
  locale: Locale,
  params: EmailTemplateParams | null,
): { subject: string; body: string } | null {
  const template = TEMPLATES[templateKey];
  if (!template || !params) return null;
  const t = createTranslator(locale);
  return { subject: t(template.subject, params), body: t(template.body, params) };
}
