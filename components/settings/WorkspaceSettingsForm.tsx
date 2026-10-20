"use client";

import { localizeApiError } from "@/lib/i18n/api-errors";
import { Check, Save } from "lucide-react";
import { useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { WorkspaceSettingsInput } from "@/lib/validation/settings";

type SettingLabelKey =
  | "navigation.businessFormation"
  | "navigation.clients"
  | "navigation.jurisdictionLens"
  | "navigation.formation"
  | "navigation.compliance";

const timezones = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Asia/Singapore",
];

const landingPages: Array<[WorkspaceSettingsInput["defaultLandingPage"], SettingLabelKey]> = [
  ["/command-center", "navigation.businessFormation"],
  ["/clients", "navigation.clients"],
  ["/jurisdictions", "navigation.jurisdictionLens"],
  ["/formation", "navigation.formation"],
  ["/compliance", "navigation.compliance"],
];

export function WorkspaceSettingsForm({
  initialSettings,
  canManage,
}: {
  initialSettings: WorkspaceSettingsInput;
  canManage: boolean;
}) {
  const { t } = useLocale();
  const [settings, setSettings] = useState(initialSettings);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  function update<K extends keyof WorkspaceSettingsInput>(key: K, value: WorkspaceSettingsInput[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
    setMessage("");
  }

  async function saveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(localizeApiError(t, result.error, t("app.settings.saveError")));
      setSettings(result.data);
      setMessage(t("app.settings.saved"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("app.settings.saveError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={saveSettings}>
      <section className="glass-panel p-5 sm:p-6">
        <div className="section-header mb-5">
          <div>
            <h2>{t("app.settings.defaults")}</h2>
            <p>{t("app.settings.defaultsDescription")}</p>
          </div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="space-y-2 text-sm text-slate-300">
            <span>{t("app.settings.timezone")}</span>
            <select
              className="min-h-11 w-full rounded-md border border-white/10 bg-[#0b1128] px-3 text-sm text-white"
              value={settings.timezone}
              disabled={!canManage}
              onChange={(event) => update("timezone", event.target.value)}
            >
              {!timezones.includes(settings.timezone) ? <option>{settings.timezone}</option> : null}
              {timezones.map((timezone) => <option key={timezone}>{timezone}</option>)}
            </select>
          </label>
          <label className="space-y-2 text-sm text-slate-300">
            <span>{t("app.settings.landingPage")}</span>
            <select
              className="min-h-11 w-full rounded-md border border-white/10 bg-[#0b1128] px-3 text-sm text-white"
              value={settings.defaultLandingPage}
              disabled={!canManage}
              onChange={(event) => update("defaultLandingPage", event.target.value as WorkspaceSettingsInput["defaultLandingPage"])}
            >
              {landingPages.map(([href, labelKey]) => <option key={href} value={href}>{t(labelKey)}</option>)}
            </select>
          </label>
          <label className="space-y-2 text-sm text-slate-300">
            <span>{t("app.settings.reminderWindow")}</span>
            <input
              className="min-h-11 w-full rounded-md border border-white/10 bg-[#0b1128] px-3 text-sm text-white"
              type="number"
              min={1}
              max={365}
              value={settings.complianceReminderDays}
              disabled={!canManage}
              onChange={(event) => update("complianceReminderDays", Number(event.target.value))}
            />
          </label>
          <label className="space-y-2 text-sm text-slate-300">
            <span>{t("app.settings.retentionPolicy")}</span>
            <input
              className="min-h-11 w-full rounded-md border border-white/10 bg-[#0b1128] px-3 text-sm text-white"
              type="number"
              min={1}
              max={36500}
              value={settings.documentRetentionDays ?? ""}
              placeholder={t("app.settings.retentionPlaceholder")}
              disabled={!canManage}
              onChange={(event) => update(
                "documentRetentionDays",
                event.target.value === "" ? null : Number(event.target.value),
              )}
            />
            <span className="block text-xs text-slate-500">
              {t("app.settings.retentionDescription")}
            </span>
          </label>
        </div>
      </section>

      <section className="glass-panel p-5 sm:p-6">
        <div className="section-header mb-4">
          <div>
            <h2>{t("app.settings.notifications")}</h2>
            <p>{t("app.settings.notificationsDescription")}</p>
          </div>
        </div>
        <div className="divide-y divide-white/5">
          {([
            ["notificationsEnabled", "app.settings.workspaceNotifications", "app.settings.masterNotificationControl"],
            ["complianceDueNotifications", "app.settings.complianceDeadlines", "app.settings.upcomingOverdue"],
            ["evidenceReviewNotifications", "app.settings.evidenceReview", "app.settings.awaitingReview"],
          ] as const).map(([key, label, detail]) => (
            <label key={key} className="flex min-h-16 items-center justify-between gap-4 py-3">
              <span>
                <span className="block text-sm font-medium text-slate-200">{t(label)}</span>
                <span className="mt-1 block text-xs text-slate-500">{t(detail)}</span>
              </span>
              <input
                type="checkbox"
                className="h-4 w-4 accent-[#d6b66a]"
                checked={settings[key]}
                disabled={!canManage || (key !== "notificationsEnabled" && !settings.notificationsEnabled)}
                onChange={(event) => update(key, event.target.checked)}
              />
            </label>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {!canManage ? <p className="text-sm text-slate-500">{t("app.settings.readOnly")}</p> : <span role="status" className="text-sm text-emerald-300">{message}</span>}
        {canManage ? (
          <button className="button button-primary gap-2" type="submit" disabled={saving}>
            {message === t("app.settings.saved") ? <Check size={16} /> : <Save size={16} />}
            {saving ? t("app.settings.saving") : t("app.settings.save")}
          </button>
        ) : null}
      </div>
    </form>
  );
}