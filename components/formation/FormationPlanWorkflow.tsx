"use client";

import { ArrowRight, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormationTimeline } from "@/components/formation/FormationTimeline";

type Candidate = {
  comparisonSnapshotId: string;
  jurisdictionId: string;
  jurisdictionName: string;
  profileName: string;
  clientName: string;
  methodologyVersion: string;
  comparedAt: string;
};

type Plan = {
  id: string;
  clientId: string;
  clientName: string;
  jurisdictionName: string;
  status: string;
  updatedAt: string;
  documents: Array<{ id: string; name: string }>;
  stages: Array<{
    key: string;
    title: string;
    description: string;
    status: string;
    tasks: Array<{
      id: string;
      key: string;
      title: string;
      description: string;
      status: string;
      requiresProfessionalReview: boolean;
      reviewCompleted: boolean;
      blockingReason: string | null;
      evidenceRequirements: Array<{
        id: string;
        key: string;
        label: string;
        required: boolean;
        satisfied: boolean;
      }>;
    }>;
  }>;
};

export function FormationPlanWorkflow({
  plans,
  candidates,
  canManage,
  canReview,
}: {
  plans: Plan[];
  candidates: Candidate[];
  canManage: boolean;
  canReview: boolean;
}) {
  const router = useRouter();
  const [candidateKey, setCandidateKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const candidate = candidates.find((item) => `${item.comparisonSnapshotId}:${item.jurisdictionId}` === candidateKey);

  async function createPlan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!candidate) return;
    const formData = new FormData(event.currentTarget);
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/formation/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          comparisonSnapshotId: candidate.comparisonSnapshotId,
          jurisdictionId: candidate.jurisdictionId,
          rationale: formData.get("rationale"),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to create formation plan.");
      setCandidateKey("");
      setMessage("Formation plan created.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create formation plan.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-5">
      {canManage ? (
        <form className="glass-panel space-y-4 p-5" onSubmit={createPlan}>
          <div className="section-header">
            <div>
              <h2>Start a formation plan</h2>
              <p>Choose a jurisdiction from a saved comparison. The decision and plan are recorded together.</p>
            </div>
            <Plus size={18} aria-hidden="true" className="text-amber-300" />
          </div>
          {candidates.length ? (
            <>
              <label className="block space-y-2 text-sm text-slate-300">
                <span>Comparison candidate</span>
                <select
                  className="min-h-11 w-full rounded-md border border-white/10 bg-[#0b1128] px-3 text-sm text-white"
                  value={candidateKey}
                  onChange={(event) => setCandidateKey(event.target.value)}
                  required
                >
                  <option value="" disabled>Select a client and jurisdiction</option>
                  {candidates.map((option) => (
                    <option key={`${option.comparisonSnapshotId}:${option.jurisdictionId}`} value={`${option.comparisonSnapshotId}:${option.jurisdictionId}`}>
                      {option.clientName} · {option.profileName} · {option.jurisdictionName} · {new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(option.comparedAt))}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-2 text-sm text-slate-300">
                <span>Decision rationale</span>
                <textarea
                  className="min-h-20 w-full rounded-md border border-white/10 bg-[#0b1128] px-3 py-2 text-sm text-white"
                  name="rationale"
                  maxLength={5000}
                  placeholder="Record the reason for selecting this working jurisdiction."
                />
              </label>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p role="status" className="text-sm text-slate-400">{message}</p>
                <button className="button button-primary gap-2" type="submit" disabled={saving || !candidate}>
                  {saving ? "Creating…" : "Create plan"} <ArrowRight size={15} />
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-400">
              <p>No saved comparisons with a client business profile are available.</p>
              <Link className="button gap-2" href="/jurisdictions">Open jurisdiction lens <ArrowRight size={14} /></Link>
            </div>
          )}
        </form>
      ) : (
        <p className="text-sm text-slate-500">You have read-only formation access.</p>
      )}

      {message && !canManage ? <p role="status" className="text-sm text-rose-300">{message}</p> : null}

      {plans.length === 0 ? (
        <div className="rounded-lg border border-dashed border-white/10 p-10 text-center">
          <h2 className="text-base font-medium text-white">No formation plans yet</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-400">Plans appear here after a working jurisdiction is selected from a saved comparison.</p>
        </div>
      ) : plans.map((plan) => (
        <article key={plan.id} className="space-y-4 border-t border-white/10 pt-5">
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">{plan.clientName}</h2>
              <p className="mt-1 text-sm text-slate-400">{plan.jurisdictionName} · Updated {new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(plan.updatedAt))}</p>
            </div>
            <span className="status-badge status-info">{plan.status.replaceAll("_", " ")}</span>
          </header>
          <FormationTimeline
            planId={plan.id}
            planClientId={plan.clientId}
            stages={plan.stages.map((stage) => ({
              ...stage,
              tasks: stage.tasks.map((task) => ({ ...task, blockingReason: task.blockingReason ?? undefined })),
            }))}
            documents={plan.documents}
            canManage={canManage}
            canReview={canReview}
          />
        </article>
      ))}
    </section>
  );
}