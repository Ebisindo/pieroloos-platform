import type { ComplianceNotification } from "@/lib/services/compliance-notification";

export function NotificationInbox({ notifications }: { notifications: ComplianceNotification[] }) {
  if (!notifications.length) {
    return <div className="empty-inline">No operational notifications have been delivered to you.</div>;
  }

  return (
    <ol className="notification-list" aria-label="Operational notifications">
      {notifications.map((notification) => (
        <li className="notification-row" key={notification.id}>
          <div>
            <h3>{notification.subject}</h3>
            <p>{notification.body}</p>
          </div>
          <time dateTime={notification.scheduledFor.toISOString()}>
            {notification.scheduledFor.toISOString().replace("T", " ").slice(0, 16)} UTC
          </time>
        </li>
      ))}
    </ol>
  );
}
