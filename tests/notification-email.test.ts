import { beforeEach, describe, expect, it, vi } from "vitest";

const { sendMailMock, createTransportMock } = vi.hoisted(() => ({
  sendMailMock: vi.fn(),
  createTransportMock: vi.fn(),
}));

vi.mock("nodemailer", () => ({
  default: { createTransport: createTransportMock },
}));

import { sendNotificationEmail } from "@/lib/services/notification-email";

describe("SMTP notification delivery", () => {
  beforeEach(() => {
    vi.stubEnv("SMTP_HOST", "smtp.example.com");
    vi.stubEnv("SMTP_PORT", "587");
    vi.stubEnv("SMTP_SECURE", "false");
    vi.stubEnv("SMTP_USERNAME", "smtp-user");
    vi.stubEnv("SMTP_PASSWORD", "smtp-secret");
    vi.stubEnv("SMTP_FROM", "PieroloOS <alerts@example.com>");
    vi.stubEnv("SMTP_MESSAGE_ID_DOMAIN", "");
    sendMailMock.mockReset().mockResolvedValue({
      messageId: "<provider-message@example.com>",
      response: "250 accepted",
    });
    createTransportMock.mockReset().mockReturnValue({ sendMail: sendMailMock });
  });

  it("uses a stable message ID and escapes untrusted template content", async () => {
    const notification = {
      id: "notice-1",
      templateKey: "operational-action-escalation",
      templateVersion: 1,
      subject: "Review <action>",
      body: "Evidence <script>alert(1)</script> & confirm.",
      recipientEmail: "recipient@example.com",
    };

    const receipt = await sendNotificationEmail(notification);
    await sendNotificationEmail(notification);

    expect(createTransportMock).toHaveBeenCalledWith(expect.objectContaining({
      host: "smtp.example.com",
      port: 587,
      secure: false,
      requireTLS: true,
      tls: { rejectUnauthorized: true },
    }));
    const message = sendMailMock.mock.calls[0][0];
    expect(message.messageId).toBe(sendMailMock.mock.calls[1][0].messageId);
    expect(message.messageId).toContain("@example.com>");
    expect(message.html).not.toContain("<script>");
    expect(message.html).toContain("&lt;script&gt;");
    expect(receipt).toEqual({ messageId: "<provider-message@example.com>", response: "250 accepted" });
  });

  it("fails closed when the pinned template version is unavailable", async () => {
    await expect(sendNotificationEmail({
      id: "notice-1",
      templateKey: "operational-action-escalation",
      templateVersion: 2,
      subject: "Subject",
      body: "Body",
      recipientEmail: "recipient@example.com",
    })).rejects.toThrow("NOTIFICATION_TEMPLATE_UNAVAILABLE");
    expect(sendMailMock).not.toHaveBeenCalled();
  });
});
