import { createHash } from "node:crypto";
import nodemailer from "nodemailer";

export type EmailNotification = {
  id: string;
  templateKey: string;
  templateVersion: number;
  subject: string;
  body: string;
  recipientEmail: string;
};

export type EmailDeliveryReceipt = {
  messageId: string;
  response: string;
};

function requiredSetting(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required SMTP setting: ${name}`);
  return value;
}

function renderTemplate(notification: EmailNotification) {
  if (notification.templateVersion !== 1 ||
    !["operational-action-escalation", "legacy-notification"].includes(notification.templateKey)) {
    throw new Error("NOTIFICATION_TEMPLATE_UNAVAILABLE");
  }

  const escapedBody = notification.body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

  return {
    subject: notification.subject,
    text: notification.body,
    html: `<main><h1>${notification.subject.replace(/[&<>"]/g, "")}</h1><p>${escapedBody.replace(/\n/g, "<br>")}</p></main>`,
  };
}

export async function sendNotificationEmail(notification: EmailNotification): Promise<EmailDeliveryReceipt> {
  const port = Number(requiredSetting("SMTP_PORT"));
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("INVALID_SMTP_PORT");
  const user = process.env.SMTP_USERNAME?.trim();
  const pass = process.env.SMTP_PASSWORD;
  if (Boolean(user) !== Boolean(pass)) throw new Error("SMTP_USERNAME_AND_PASSWORD_MUST_BE_PAIRED");
  const from = requiredSetting("SMTP_FROM");
  const messageIdDomain = process.env.SMTP_MESSAGE_ID_DOMAIN?.trim() || from.match(/@([^>\s]+)/)?.[1];
  if (!messageIdDomain || !/^[a-z0-9.-]+$/i.test(messageIdDomain)) {
    throw new Error("INVALID_SMTP_MESSAGE_ID_DOMAIN");
  }
  if (process.env.SMTP_SECURE && !["true", "false"].includes(process.env.SMTP_SECURE)) {
    throw new Error("INVALID_SMTP_SECURE_SETTING");
  }

  const secure = process.env.SMTP_SECURE === "true";
  const transport = nodemailer.createTransport({
    host: requiredSetting("SMTP_HOST"),
    port,
    secure,
    requireTLS: !secure,
    ...(user && pass ? { auth: { user, pass } } : {}),
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 30_000,
    tls: { rejectUnauthorized: true },
  });
  const template = renderTemplate(notification);
  const messageId = `<${createHash("sha256").update(notification.id).digest("hex")}@${messageIdDomain}>`;
  const response = await transport.sendMail({
    from,
    to: notification.recipientEmail,
    ...template,
    messageId,
    headers: { "X-PieroloOS-Notification-ID": notification.id },
  });

  return {
    messageId: response.messageId || messageId,
    response: String(response.response ?? "SMTP server accepted the message").slice(0, 512),
  };
}
