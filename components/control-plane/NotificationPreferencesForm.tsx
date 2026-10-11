"use client";

import { localizeApiError } from "@/lib/i18n/api-errors";
import { useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";

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
  const { t } = useLocale();
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
      if (!response.ok) throw new Error(localizeApiError(t, result.error, t("app.notificationPreferences.saveError")));
      setPreferences(result.data);
      setMessage(t("app.notificationPreferences.saved"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("app.notificationPreferences.saveError"));
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
        {t("app.notificationPreferences.inApp")}
      </label>
      <label>
        <input
          type="checkbox"
          checked={preferences.emailEnabled}
          onChange={(event) => setPreferences({ ...preferences, emailEnabled: event.target.checked })}
        />
        {t("app.notificationPreferences.emailOptIn")}
      </label>
      <label>
        {t("app.notificationPreferences.timezone")}
        <input
          value={preferences.timezone}
          maxLength={100}
          onChange={(event) => setPreferences({ ...preferences, timezone: event.target.value })}
          placeholder="America/New_York"
        />
      </label>
      <div className="notification-quiet-hours">
        <label>
          {t("app.notificationPreferences.quietStart")}
          <input
            type="time"
            value={preferences.quietHoursStart ?? ""}
            onChange={(event) => setPreferences({ ...preferences, quietHoursStart: event.target.value || null })}
          />
        </label>
        <label>
          {t("app.notificationPreferences.quietEnd")}
          <input
            type="time"
            value={preferences.quietHoursEnd ?? ""}
            onChange={(event) => setPreferences({ ...preferences, quietHoursEnd: event.target.value || null })}
          />
        </label>
      </div>
      <button className="button button-secondary" type="submit" disabled={saving}>
        {saving ? t("app.notificationPreferences.saving") : t("app.notificationPreferences.save")}
      </button>
      {message ? <p role="status">{message}</p> : null}
    </form>
  );
}
