"use client";

import { localizeApiError } from "@/lib/i18n/api-errors";
import { disableWebPushNotifications, enableWebPushNotifications } from "@/lib/firebase/messaging-client";
import { useState } from "react";
import { locales, type Locale } from "@/lib/i18n/config";
import { useLocale } from "@/components/i18n/LocaleProvider";

export type NotificationPreferences = {
  inAppEnabled: boolean;
  emailEnabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  timezone: string;
  locale?: string;
  pushEnabled?: boolean;
};

export function NotificationPreferencesForm({
  initialPreferences,
}: {
  initialPreferences: NotificationPreferences;
}) {
  const { t } = useLocale();
  const [preferences, setPreferences] = useState({
    inAppEnabled: initialPreferences.inAppEnabled,
    emailEnabled: initialPreferences.emailEnabled,
    quietHoursStart: initialPreferences.quietHoursStart,
    quietHoursEnd: initialPreferences.quietHoursEnd,
    timezone: initialPreferences.timezone,
    locale: initialPreferences.locale,
  });
  const [pushEnabled, setPushEnabled] = useState(initialPreferences.pushEnabled ?? false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

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
      setPreferences({
        inAppEnabled: result.data.inAppEnabled,
        emailEnabled: result.data.emailEnabled,
        quietHoursStart: result.data.quietHoursStart,
        quietHoursEnd: result.data.quietHoursEnd,
        timezone: result.data.timezone,
        locale: result.data.locale,
      });
      setPushEnabled(result.data.pushEnabled ?? pushEnabled);
      setMessage(t("app.notificationPreferences.saved"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("app.notificationPreferences.saveError"));
    } finally {
      setSaving(false);
    }
  }

  async function toggleBrowserPush() {
    setPushBusy(true);
    setMessage("");
    try {
      if (pushEnabled) {
        const disabled = await disableWebPushNotifications();
        if (!disabled) throw new Error("Unable to disable browser push notifications. Please try again.");
        setPushEnabled(false);
        setMessage("Browser push notifications disabled.");
      } else {
        const result = await enableWebPushNotifications();
        if (!result.ok) throw new Error(result.reason);
        setPushEnabled(true);
        setMessage("Browser push notifications enabled.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update browser push notifications.");
    } finally {
      setPushBusy(false);
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
      <div className="notification-push-control">
        <p>Browser push notifications: {pushEnabled ? "Enabled" : "Disabled"}</p>
        <button
          className="button button-secondary"
          type="button"
          onClick={toggleBrowserPush}
          disabled={pushBusy}
        >
          {pushBusy ? "Updating…" : pushEnabled ? "Disable browser push" : "Enable browser push"}
        </button>
      </div>
      <label>
        {t("app.notificationPreferences.timezone")}
        <input
          value={preferences.timezone}
          maxLength={100}
          onChange={(event) => setPreferences({ ...preferences, timezone: event.target.value })}
          placeholder="America/New_York"
        />
      </label>
      <label>
        {t("app.notificationPreferences.language")}
        <select
          value={preferences.locale ?? "en"}
          onChange={(event) => setPreferences({ ...preferences, locale: event.target.value })}
        >
          {(Object.keys(locales) as Locale[]).map((code) => (
            <option key={code} value={code} lang={locales[code].htmlLang}>{locales[code].name}</option>
          ))}
        </select>
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
