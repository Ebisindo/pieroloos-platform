"use client";

import { Check, Save } from "lucide-react";
import { useState } from "react";
import type { WorkspaceSettingsInput } from "@/lib/validation/settings";

const timezones = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Asia/Singapore",
];

const landingPages: Array<[WorkspaceSettingsInput["defaultLandingPage"], string]> = [
  ["/command-center", "Business Formation"],
  ["/clients", "Clients"],
  ["/jurisdictions", "Jurisdiction Lens"],
  ["/formation", "Formation"],
  ["/compliance", "Compliance"],
];

export function WorkspaceSettingsForm({
  initialSettings,
  canManage,
}: {
  initialSettings: WorkspaceSettingsInput;
  canManage: boolean;
}) {
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
      if (!response.ok) throw new Error(result.error ?? "Unable to save settings.");
      setSettings(result.data);
      setMessage("Workspace settings saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={saveSettings}>
      <section className="glass-panel p-5 sm:p-6">
        <div className="section-header mb-5">
          <div>
            <h2>Workspace defaults</h2>
            <p>Shared operating preferences for this workspace.</p>
          </div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="space-y-2 text-sm text-slate-300">
            <span>Time zone</span>
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
            <span>Default landing page</span>
            <select
              className="min-h-11 w-full rounded-md border border-white/10 bg-[#0b1128] px-3 text-sm text-white"
              value={settings.defaultLandingPage}
              disabled={!canManage}
              onChange={(event) => update("defaultLandingPage", event.target.value as WorkspaceSettingsInput["defaultLandingPage"])}
            >
              {landingPages.map(([href, label]) => <option key={href} value={href}>{label}</option>)}
            </select>
          </label>
          <label className="space-y-2 text-sm text-slate-300">
            <span>Compliance reminder window (days)</span>
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
            <span>Document retention policy (days)</span>
            <input
              className="min-h-11 w-full rounded-md border border-white/10 bg-[#0b1128] px-3 text-sm text-white"
              type="number"
              min={1}
              max={36500}
              value={settings.documentRetentionDays ?? ""}
              placeholder="Required before document uploads"
              disabled={!canManage}
              onChange={(event) => update(
                "documentRetentionDays",
                event.target.value === "" ? null : Number(event.target.value),
              )}
            />
            <span className="block text-xs text-slate-500">
              New uploads require this policy. Retention starts on upload; deletion is blocked until it expires.
            </span>
          </label>
        </div>
      </section>

      <section className="glass-panel p-5 sm:p-6">
        <div className="section-header mb-4">
          <div>
            <h2>Notifications</h2>
            <p>Choose which operational events create workspace notifications.</p>
          </div>
        </div>
        <div className="divide-y divide-white/5">
          {([
            ["notificationsEnabled", "Workspace notifications", "Master notification control"],
            ["complianceDueNotifications", "Compliance deadlines", "Upcoming and overdue obligations"],
            ["evidenceReviewNotifications", "Evidence review", "Items awaiting professional review"],
          ] as const).map(([key, label, detail]) => (
            <label key={key} className="flex min-h-16 items-center justify-between gap-4 py-3">
              <span>
                <span className="block text-sm font-medium text-slate-200">{label}</span>
                <span className="mt-1 block text-xs text-slate-500">{detail}</span>
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
        {!canManage ? <p className="text-sm text-slate-500">You have read-only settings access.</p> : <span role="status" className="text-sm text-emerald-300">{message}</span>}
        {canManage ? (
          <button className="button button-primary gap-2" type="submit" disabled={saving}>
            {message === "Workspace settings saved." ? <Check size={16} /> : <Save size={16} />}
            {saving ? "Saving…" : "Save settings"}
          </button>
        ) : null}
      </div>
    </form>
  );
}