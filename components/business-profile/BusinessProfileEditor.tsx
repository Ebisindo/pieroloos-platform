"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { MessageKey } from "@/lib/i18n/messages";

type Profile = {
  id: string;
  version: number;
  data: unknown;
  businessName: string | null;
  businessType: string | null;
  businessObjective: string | null;
  businessModel: string | null;
  targetMarket: string | null;
  revenueModel: string | null;
  ownershipContext: string | null;
  fundingStage: string | null;
  expansionObjectives: string | null;
  constraints: string | null;
  strategicNotes: string | null;
  operationalContext: string | null;
  client: { id: string; name: string | null; organizationName: string | null; email: string | null; country: string | null };
};

const fieldConfig: Array<{ key: string; label: MessageKey; multiline?: boolean }> = [
  { key: "businessName", label: "profile.field.businessName" },
  { key: "businessType", label: "profile.field.businessType" },
  { key: "objective", label: "profile.field.objective", multiline: true },
  { key: "businessModel", label: "profile.field.businessModel", multiline: true },
  { key: "targetMarket", label: "profile.field.targetMarket", multiline: true },
  { key: "revenueModel", label: "profile.field.revenueModel", multiline: true },
  { key: "ownership", label: "profile.field.ownership", multiline: true },
  { key: "fundingStage", label: "profile.field.fundingStage" },
  { key: "expansionObjectives", label: "profile.field.expansionObjectives", multiline: true },
  { key: "riskConstraints", label: "profile.field.riskConstraints", multiline: true },
  { key: "strategicNotes", label: "profile.field.strategicNotes", multiline: true },
  { key: "operationalContext", label: "profile.field.operationalContext", multiline: true },
];

function initialValues(profile: Profile) {
  const source: Record<string, unknown> =
    profile.data && typeof profile.data === "object" && !Array.isArray(profile.data)
      ? profile.data as Record<string, unknown>
      : {};
  return {
    businessName: profile.businessName ?? (typeof source.businessName === "string" ? source.businessName : ""),
    businessType: profile.businessType ?? (typeof source.businessType === "string" ? source.businessType : ""),
    objective: profile.businessObjective ?? (typeof source.objective === "string" ? source.objective : ""),
    businessModel: profile.businessModel ?? (typeof source.businessModel === "string" ? source.businessModel : ""),
    targetMarket: profile.targetMarket ?? (typeof source.targetMarket === "string" ? source.targetMarket : ""),
    revenueModel: profile.revenueModel ?? (typeof source.revenueModel === "string" ? source.revenueModel : ""),
    ownership: profile.ownershipContext ?? (typeof source.ownership === "string" ? source.ownership : ""),
    fundingStage: profile.fundingStage ?? (typeof source.fundingStage === "string" ? source.fundingStage : ""),
    expansionObjectives: profile.expansionObjectives ?? (typeof source.expansionObjectives === "string" ? source.expansionObjectives : ""),
    riskConstraints: profile.constraints ?? (typeof source.riskConstraints === "string" ? source.riskConstraints : ""),
    strategicNotes: profile.strategicNotes ?? (typeof source.strategicNotes === "string" ? source.strategicNotes : ""),
    operationalContext: profile.operationalContext ?? (typeof source.operationalContext === "string" ? source.operationalContext : ""),
  };
}

export function BusinessProfileEditor({ profile: initialProfile, canWrite }: { profile: Profile; canWrite: boolean }) {
  const { t } = useLocale();
  const router = useRouter();
  const [profile, setProfile] = useState(initialProfile);
  const [values, setValues] = useState(initialValues(initialProfile));
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setProfile(initialProfile);
    setValues(initialValues(initialProfile));
  }, [initialProfile]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite || state === "saving") return;
    setState("saving");
    setMessage("");
    try {
      const response = await fetch(`/api/business-profile/${encodeURIComponent(profile.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value.trim()]))),
      });
      const result = await response.json() as { error?: string; data?: Profile };
      if (!response.ok || !result.data) throw new Error(result.error ?? t("profile.saveFailed"));
      setProfile(result.data);
      setValues(initialValues(result.data));
      setState("saved");
      setMessage(t("profile.savedVersion", { version: result.data.version }));
      router.refresh();
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : t("profile.saveFailed"));
    }
  }

  return (
    <form className="space-y-5" onSubmit={submit}>
      <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 md:p-7" aria-labelledby="profile-record-heading">
        <div className="mb-5">
          <h2 id="profile-record-heading" className="text-lg font-semibold text-white">{profile.client.organizationName ?? profile.client.name ?? t("profile.unnamedBusiness")}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-300">{[profile.client.country, profile.client.email].filter(Boolean).join(" · ") || t("profile.noContactDetails")}</p>
          <p className="mt-2 text-xs text-slate-400">{t("profile.version", { version: profile.version })}</p>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          {fieldConfig.map((field) => (
            <label key={field.key} className={`block min-w-0 space-y-2 ${field.multiline ? "md:col-span-2" : ""}`}>
              <span className="text-sm font-medium text-slate-200">{t(field.label)}</span>
              {field.multiline ? (
                <textarea rows={3} maxLength={5000} disabled={!canWrite || state === "saving"} value={values[field.key as keyof typeof values]} onChange={(event) => { setValues((current) => ({ ...current, [field.key]: event.target.value })); setState("idle"); }} className="w-full rounded-xl border border-white/15 bg-slate-950/70 px-4 py-3 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300 disabled:opacity-70" />
              ) : (
                <input maxLength={field.key === "businessName" ? 200 : 150} disabled={!canWrite || state === "saving"} value={values[field.key as keyof typeof values]} onChange={(event) => { setValues((current) => ({ ...current, [field.key]: event.target.value })); setState("idle"); }} className="min-h-11 w-full rounded-xl border border-white/15 bg-slate-950/70 px-4 py-3 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300 disabled:opacity-70" />
              )}
            </label>
          ))}
        </div>
      </section>
      <div className="rounded-xl border border-amber-300/20 bg-amber-300/[0.04] p-4 text-sm leading-6 text-amber-100">{t("profile.reviewBoundary")}</div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p aria-live="polite" role={state === "error" ? "alert" : "status"} className="text-sm text-slate-200">{message || (!canWrite ? t("profile.readOnly") : t("profile.saveHelp"))}</p>
        {canWrite ? <button disabled={state === "saving"} type="submit" className="min-h-11 rounded-xl border border-amber-300/30 bg-amber-300/10 px-5 py-3 text-sm font-semibold text-amber-100 hover:bg-amber-300/15 disabled:opacity-50">{state === "saving" ? t("profile.saving") : t("profile.save")}</button> : null}
      </div>
    </form>
  );
}
