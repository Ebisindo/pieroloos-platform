import { beforeEach, describe, expect, it, vi } from "vitest";

const { sendMailMock, createTransportMock } = vi.hoisted(() => ({
  sendMailMock: vi.fn(),
  createTransportMock: vi.fn(),
}));

vi.mock("nodemailer", () => ({
  default: { createTransport: createTransportMock },
}));

import { buildEscalationNotification } from "@/lib/services/compliance-notification";
import { parseEmailTemplateParams, renderLocalizedEmailText, resolveEmailLocale } from "@/lib/i18n/email-templates";
import { locales, type Locale } from "@/lib/i18n/config";
import { sendNotificationEmail } from "@/lib/services/notification-email";
import { notificationPreferenceSchema } from "@/lib/validation/notification-preferences";

const base = {
  id: "notice-1",
  templateKey: "operational-action-escalation",
  templateVersion: 1,
  subject: "Action escalated to level 2",
  body: 'Action "File return" has escalated to level 2.',
  recipientEmail: "recipient@example.com",
};
const params = { title: "File return", level: 2 };

describe("localized notification email", () => {
  beforeEach(() => {
    vi.stubEnv("SMTP_HOST", "smtp.example.com");
    vi.stubEnv("SMTP_PORT", "587");
    vi.stubEnv("SMTP_SECURE", "false");
    vi.stubEnv("SMTP_USERNAME", "u");
    vi.stubEnv("SMTP_PASSWORD", "p");
    vi.stubEnv("SMTP_FROM", "PieroloOS <alerts@example.com>");
    sendMailMock.mockReset().mockResolvedValue({ messageId: "<m@example.com>", response: "250 ok" });
    createTransportMock.mockReset().mockReturnValue({ sendMail: sendMailMock });
  });

  it("renders every locale with interpolated values and no leftover placeholders", () => {
    for (const locale of Object.keys(locales) as Locale[]) {
      const text = renderLocalizedEmailText(base.templateKey, locale, params)!;
      expect(text.subject).toContain("2");
      expect(text.body).toContain("File return");
      expect(`${text.subject}${text.body}`).not.toMatch(/\{\w+\}/);
    }
    expect(renderLocalizedEmailText(base.templateKey, "fr", params)!.subject).not.toBe(
      renderLocalizedEmailText(base.templateKey, "en", params)!.subject,
    );
  });

  it("falls back to stored English for unknown templates, missing params and unknown locales", () => {
    expect(renderLocalizedEmailText("legacy-notification", "fr", params)).toBeNull();
    expect(renderLocalizedEmailText(base.templateKey, "fr", null)).toBeNull();
    expect(resolveEmailLocale("de")).toBe("en");
    expect(resolveEmailLocale(undefined)).toBe("en");
    expect(resolveEmailLocale("es")).toBe("es");
  });

  it("accepts only the expected primitive params from stored JSON", () => {
    expect(parseEmailTemplateParams(base.templateKey, { ...params, extra: "x" })).toEqual(params);
    expect(parseEmailTemplateParams(base.templateKey, { title: "t" })).toBeNull();
    expect(parseEmailTemplateParams(base.templateKey, { title: {}, level: 1 })).toBeNull();
    expect(parseEmailTemplateParams(base.templateKey, "nope")).toBeNull();
    expect(parseEmailTemplateParams(base.templateKey, [])).toBeNull();
  });

  it("sends the recipient's language with a matching lang attribute and escapes user content", async () => {
    await sendNotificationEmail({ ...base, locale: "pt", templateParams: { title: "<b>Declaração</b>", level: 3 } });
    const message = sendMailMock.mock.calls[0][0];
    expect(message.subject).toBe("Ação escalada para o nível 3");
    expect(message.html).toContain('<main lang="pt">');
    expect(message.html).toContain("&lt;b&gt;");
    expect(message.html).not.toContain("<b>");
  });

  it("keeps the stored English message when no locale or params are supplied", async () => {
    await sendNotificationEmail(base);
    await sendNotificationEmail({ ...base, locale: "fr", templateParams: null });
    for (const [message] of sendMailMock.mock.calls) {
      expect(message.subject).toBe(base.subject);
      expect(message.text).toBe(base.body);
      expect(message.html).toContain('<main lang="en">');
    }
  });

  it("queues escalation notifications with params while keeping the English stored text", () => {
    const notification = buildEscalationNotification(
      { id: "a1", organizationId: "o", workspaceId: "w", title: "File return", createdByUserId: "u" } as never,
      2,
    );
    expect(notification.subject).toBe("Action escalated to level 2");
    expect(notification.body).toBe('Action "File return" has escalated to level 2.');
    expect(notification.templateParams).toEqual(params);
  });

  it("validates the preference locale against the registry and stays backwards compatible", () => {
    const preference = {
      inAppEnabled: true,
      emailEnabled: true,
      quietHoursStart: null,
      quietHoursEnd: null,
      timezone: "UTC",
    };
    expect(notificationPreferenceSchema.safeParse(preference).success).toBe(true);
    expect(notificationPreferenceSchema.safeParse({ ...preference, locale: "fr" }).success).toBe(true);
    expect(notificationPreferenceSchema.safeParse({ ...preference, locale: "de" }).success).toBe(false);
  });
});
