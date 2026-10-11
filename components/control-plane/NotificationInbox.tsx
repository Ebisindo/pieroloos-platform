import type { ComplianceNotification } from "@/lib/services/compliance-notification";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { MessageKey } from "@/lib/i18n/messages";
import { formatDate } from "@/lib/i18n/messages";

export function NotificationInbox({ notifications }: { notifications: ComplianceNotification[] }) {
  const { locale, t } = useLocale();
  if (!notifications.length) {
    return <div className="empty-inline">{t("app.notifications.none")}</div>;
  }

  const statusKeys: Record<ComplianceNotification["status"], MessageKey> = {
    QUEUED: "app.notifications.queued",
    PROCESSING: "app.notifications.processing",
    SENT: "app.notifications.sent",
    FAILED: "app.notifications.failed",
    DEAD_LETTER: "app.notifications.deadLetter",
    CANCELLED: "app.notifications.cancelled",
  };

  return (
    <ol className="notification-list" aria-label={t("app.notifications.ariaLabel")}>
      {notifications.map((notification) => (
        <li className="notification-row" key={notification.id}>
          <div>
            <span className="notification-status">{notification.channel === "EMAIL" ? t("app.notifications.email") : t("app.notifications.inApp")}</span>
            <h3>{notification.subject}</h3>
            <p>{notification.body}</p>
            {notification.failureReason && notification.status !== "SENT"
              ? <p role="status">{notification.failureReason}</p>
              : null}
          </div>
          <time dateTime={notification.scheduledFor.toISOString()}>
            {formatDate(notification.scheduledFor, locale, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} {t("app.notifications.utc")}
          </time>
          <span className="notification-status">
            {notification.status === "SENT" && notification.channel === "EMAIL"
              ? t("app.notifications.acceptedByProvider")
              : t(statusKeys[notification.status])}
          </span>
        </li>
      ))}
    </ol>
  );
}
