"use client";

import { FormEvent, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { MessageKey } from "@/lib/i18n/messages";

const initial = {
  legalName: "",
  email: "",
  phone: "",
  residenceCountry: "",
  proposedName: "",
  businessType: "",
  objective: "",
  targetMarket: "",
  businessModel: "",
  revenueModel: "",
  fundingContext: "",
  ownershipContext: "",
  expansionObjectives: "",
  constraints: "",
  strategicNotes: "",
  operationalContext: "",
  service: "Business Formation Advisory",
};

export function ClientIntakeForm() {
  const { t } = useLocale();
  const [form, setForm] = useState(initial);
  const [state, setState] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  function update(key: keyof typeof initial, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("saving");
    setMessage("");

    try {
      const response = await fetch("/api/clients/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client: {
            legalName: form.legalName,
            email: form.email || undefined,
            phone: form.phone || undefined,
            residenceCountry: form.residenceCountry || undefined,
          },
          business: {
            proposedName: form.proposedName || undefined,
            businessType: form.businessType || undefined,
            objective: form.objective,
            targetMarket: form.targetMarket || undefined,
            businessModel: form.businessModel || undefined,
            revenueModel: form.revenueModel || undefined,
            fundingContext: form.fundingContext || undefined,
            ownershipContext: form.ownershipContext || undefined,
            expansionObjectives: form.expansionObjectives || undefined,
            constraints: form.constraints || undefined,
            strategicNotes: form.strategicNotes || undefined,
            operationalContext: form.operationalContext || undefined,
          },
          engagement: {
            service: form.service,
            status: "INTAKE",
          },
          intakeStatus: "SUBMITTED",
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Unable to save intake.");
      }

      setState("success");
      setMessage(t("app.intake.created", { name: result.data.legalName }));
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : t("app.intake.error"));
    }
  }

  const field = (label: MessageKey, key: keyof typeof initial, options?: { required?: boolean; textarea?: boolean; placeholder?: MessageKey }) => (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-slate-200">
        {t(label)}{options?.required ? <span aria-hidden="true" className="ml-1 text-amber-300">*</span> : null}
      </span>
      {options?.textarea ? (
        <textarea
          required={options.required}
          value={form[key]}
          onChange={(e) => update(key, e.target.value)}
          placeholder={options.placeholder ? t(options.placeholder) : undefined}
          rows={4}
          className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white transition focus:border-cyan-300/50"
        />
      ) : (
        <input
          required={options?.required}
          value={form[key]}
          onChange={(e) => update(key, e.target.value)}
          placeholder={options?.placeholder ? t(options.placeholder) : undefined}
          className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white transition focus:border-cyan-300/50"
        />
      )}
    </label>
  );

  return (
    <form onSubmit={submit} className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/20 md:p-7">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-[0.2em] text-amber-300/70">{t("app.intake.identityStep")}</p>
          <h2 className="mt-1 text-lg font-semibold text-white">{t("app.intake.identityTitle")}</h2>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          {field("app.intake.legalName", "legalName", { required: true, placeholder: "app.intake.clientPlaceholder" })}
          {field("app.intake.email", "email", { placeholder: "app.intake.emailPlaceholder" })}
          {field("app.intake.phone", "phone")}
          {field("app.intake.residenceCountry", "residenceCountry", { placeholder: "app.intake.countryPlaceholder" })}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/20 md:p-7">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-[0.2em] text-violet-300/70">{t("app.intake.businessStep")}</p>
          <h2 className="mt-1 text-lg font-semibold text-white">{t("app.intake.businessTitle")}</h2>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          {field("app.intake.proposedName", "proposedName")}
          {field("app.intake.businessType", "businessType")}
          {field("app.intake.objective", "objective", { required: true, textarea: true, placeholder: "app.intake.objectivePlaceholder" })}
          {field("app.intake.targetMarket", "targetMarket", { textarea: true })}
          {field("app.intake.businessModel", "businessModel", { textarea: true })}
          {field("app.intake.revenueModel", "revenueModel", { textarea: true })}
          {field("app.intake.fundingContext", "fundingContext", { textarea: true })}
          {field("app.intake.ownershipContext", "ownershipContext", { textarea: true })}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/20 md:p-7">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-300/70">{t("app.intake.operatingStep")}</p>
          <h2 className="mt-1 text-lg font-semibold text-white">{t("app.intake.operatingTitle")}</h2>
        </div>
        <div className="grid gap-5">
          {field("app.intake.expansionObjectives", "expansionObjectives", { textarea: true })}
          {field("app.intake.constraints", "constraints", { textarea: true })}
          {field("app.intake.strategicNotes", "strategicNotes", { textarea: true })}
          {field("app.intake.operationalContext", "operationalContext", { textarea: true })}
          {field("app.intake.requestedService", "service", { required: true })}
        </div>
      </section>

      <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-950/60 p-5 md:flex-row md:items-center md:justify-between">
        <div aria-live="polite" className="text-sm text-slate-400">
          {state === "success" && <span className="text-emerald-300">{message}</span>}
          {state === "error" && <span role="alert" className="text-rose-300">{message}</span>}
          {state === "idle" && t("app.intake.requiredHint")}
          {state === "saving" && t("app.intake.saving")}
        </div>
        <button
          disabled={state === "saving"}
          type="submit"
          className="rounded-xl border border-amber-300/30 bg-amber-300/10 px-6 py-3 text-sm font-semibold text-amber-100 transition hover:bg-amber-300/15 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {state === "saving" ? t("app.intake.creating") : t("app.intake.create")}
        </button>
      </div>
    </form>
  );
}
