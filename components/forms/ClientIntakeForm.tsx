"use client";

import { FormEvent, useState } from "react";

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
      setMessage(`Client record created: ${result.data.legalName}`);
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Unable to save intake.");
    }
  }

  const field = (label: string, key: keyof typeof initial, options?: { required?: boolean; textarea?: boolean; placeholder?: string }) => (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-slate-200">
        {label}{options?.required ? <span className="ml-1 text-amber-300">*</span> : null}
      </span>
      {options?.textarea ? (
        <textarea
          required={options.required}
          value={form[key]}
          onChange={(e) => update(key, e.target.value)}
          placeholder={options.placeholder}
          rows={4}
          className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/10"
        />
      ) : (
        <input
          required={options?.required}
          value={form[key]}
          onChange={(e) => update(key, e.target.value)}
          placeholder={options?.placeholder}
          className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/10"
        />
      )}
    </label>
  );

  return (
    <form onSubmit={submit} className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/20 md:p-7">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-[0.2em] text-amber-300/70">01 / Identity</p>
          <h2 className="mt-1 text-lg font-semibold text-white">Client identity</h2>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          {field("Legal / full name", "legalName", { required: true, placeholder: "Client or founder name" })}
          {field("Email", "email", { placeholder: "name@example.com" })}
          {field("Phone", "phone")}
          {field("Residence country", "residenceCountry", { placeholder: "Country of residence" })}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/20 md:p-7">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-[0.2em] text-violet-300/70">02 / Business Context</p>
          <h2 className="mt-1 text-lg font-semibold text-white">Proposed business</h2>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          {field("Proposed business name", "proposedName")}
          {field("Business type", "businessType")}
          {field("Business objective", "objective", { required: true, textarea: true, placeholder: "What is the client trying to build or accomplish?" })}
          {field("Target market", "targetMarket", { textarea: true })}
          {field("Business model", "businessModel", { textarea: true })}
          {field("Revenue model", "revenueModel", { textarea: true })}
          {field("Funding context", "fundingContext", { textarea: true })}
          {field("Ownership context", "ownershipContext", { textarea: true })}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/20 md:p-7">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-300/70">03 / Operating Context</p>
          <h2 className="mt-1 text-lg font-semibold text-white">Constraints and objectives</h2>
        </div>
        <div className="grid gap-5">
          {field("Expansion objectives", "expansionObjectives", { textarea: true })}
          {field("Constraints / known risks", "constraints", { textarea: true })}
          {field("Strategic notes", "strategicNotes", { textarea: true })}
          {field("Operational context", "operationalContext", { textarea: true })}
          {field("Requested service", "service", { required: true })}
        </div>
      </section>

      <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-950/60 p-5 md:flex-row md:items-center md:justify-between">
        <div aria-live="polite" className="text-sm text-slate-400">
          {state === "success" && <span className="text-emerald-300">{message}</span>}
          {state === "error" && <span className="text-rose-300">{message}</span>}
          {state === "idle" && "Required fields are marked with *."}
          {state === "saving" && "Validating and creating the client record…"}
        </div>
        <button
          disabled={state === "saving"}
          type="submit"
          className="rounded-xl border border-amber-300/30 bg-amber-300/10 px-6 py-3 text-sm font-semibold text-amber-100 transition hover:bg-amber-300/15 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {state === "saving" ? "Creating record…" : "Create Client Record"}
        </button>
      </div>
    </form>
  );
}
