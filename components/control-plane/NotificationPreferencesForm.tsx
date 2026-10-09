"use client";

import { useState } from "react";

export type NotificationPreferences = {
  inAppEnabled: boolean;
  emailEnabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  timezone: string;
};

export function NotificationPreferencesForm({
  initialPreferences,
}: {
  initialPreferences: NotificationPreferences;
}) {
  const [preferences, setPreferences] = useState(initialPreferences);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/notifications/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preferences),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to save notification preferences.");
      setPreferences(result.data);
      setMessage("Notification preferences saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save notification preferences.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="notification-preferences" onSubmit={save}>
      <label>
        <input
          type="checkbox"
          checked={preferences.inAppEnabled}
          onChange={(event) => setPreferences({ ...preferences, inAppEnabled: event.target.checked })}
        />
        In-app notifications
      </label>
      <label>
        <input
          type="checkbox"
          checked={preferences.emailEnabled}
          onChange={(event) => setPreferences({ ...preferences, emailEnabled: event.target.checked })}
        />
        Email notifications (opt in)
      </label>
      <label>
        Timezone
        <input
          value={preferences.timezone}
          maxLength={100}
          onChange={(event) => setPreferences({ ...preferences, timezone: event.target.value })}
          placeholder="America/New_York"
        />
      </label>
      <div className="notification-quiet-hours">
        <label>
          Quiet hours start
          <input
            type="time"
            value={preferences.quietHoursStart ?? ""}
            onChange={(event) => setPreferences({ ...preferences, quietHoursStart: event.target.value || null })}
          />
        </label>
        <label>
          Quiet hours end
          <input
            type="time"
            value={preferences.quietHoursEnd ?? ""}
            onChange={(event) => setPreferences({ ...preferences, quietHoursEnd: event.target.value || null })}
          />
        </label>
      </div>
      <button className="button button-secondary" type="submit" disabled={saving}>
        {saving ? "Saving…" : "Save preferences"}
      </button>
      {message ? <p role="status">{message}</p> : null}
    </form>
  );
}
