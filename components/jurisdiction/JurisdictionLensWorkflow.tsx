"use client";

import { ArrowRight, Scale } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Jurisdiction } from "@/lib/domain/jurisdiction";
import { JurisdictionCard } from "@/components/jurisdiction/JurisdictionCard";

type ProfileOption = { id: string; name: string };
type ComparisonResult = {
  jurisdictionId: string;
  analyticalIndicator: number | null;
  confidence: number;
  professionalReviewRequired: boolean;
};
type SavedComparison = {
  id: string;
  results: ComparisonResult[];
};

export function JurisdictionLensWorkflow({
  jurisdictions,
  profiles,
  canCompare,
  canCreateFormation,
}: {
  jurisdictions: Jurisdiction[];
  profiles: ProfileOption[];
  canCompare: boolean;
  canCreateFormation: boolean;
}) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [profileId, setProfileId] = useState("");
  const [rationale, setRationale] = useState("");
  const [comparison, setComparison] = useState<SavedComparison | null>(null);
  const [formationJurisdictionId, setFormationJurisdictionId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  function toggleJurisdiction(id: string) {
    setSelectedIds((current) => current.includes(id)
      ? current.filter((selectedId) => selectedId !== id)
      : [...current, id]);
    setComparison(null);
    setMessage("");
  }

  async function compareSelected() {
    if (selectedIds.length < 2) return;
    const criteriaKeys = [...new Set(jurisdictions
      .filter((jurisdiction) => selectedIds.includes(jurisdiction.id))
      .flatMap((jurisdiction) => jurisdiction.factors.map((factor) => factor.criterionKey)))]
      .filter((key) => /^[a-z0-9_]+$/.test(key));
    const keys = criteriaKeys.length ? criteriaKeys : ["available_data"];
    const criteria = keys.map((key) => ({
      key,
      name: key.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
      description: "Workspace-recorded jurisdiction observation.",
      weight: 100 / keys.length,
    }));

    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/jurisdictions/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jurisdictionIds: selectedIds,
          criteria,
          methodologyVersion: "1.0",
          ...(profileId ? { businessProfileId: profileId } : {}),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to compare selected jurisdictions.");
      setComparison({ id: result.data.snapshot.id, results: result.data.results });
      setFormationJurisdictionId(selectedIds[0]);
      setMessage("Comparison saved to this workspace.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to compare selected jurisdictions.");
    } finally {
      setBusy(false);
    }
  }

  async function createFormationPlan() {
    if (!comparison || !profileId || !formationJurisdictionId) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/formation/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          comparisonSnapshotId: comparison.id,
          jurisdictionId: formationJurisdictionId,
          rationale: rationale.trim() || undefined,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to create formation plan.");
      router.push("/formation");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create formation plan.");
    } finally {
      setBusy(false);
    }
  }

  const resultNames = new Map(jurisdictions.map((jurisdiction) => [jurisdiction.id, jurisdiction.name]));

  return (
    <div className="space-y-6">
      {canCompare ? (
        <section className="glass-panel space-y-4 p-5" aria-labelledby="comparison-heading">
          <div className="section-header">
            <div>
              <h2 id="comparison-heading">Compare selected jurisdictions</h2>
              <p>Select at least two cards. Comparisons preserve unknown data and are saved to this workspace.</p>
            </div>
            <Scale size={18} aria-hidden="true" className="text-cyan-200" />
          </div>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <label className="space-y-2 text-sm text-slate-300">
              <span>Business profile for Formation handoff</span>
              <select
                className="form-input"
                value={profileId}
                onChange={(event) => {
                  setProfileId(event.target.value);
                  setComparison(null);
                }}
              >
                <option value="">No profile selected</option>
                {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
              </select>
            </label>
            <button
              className="button button-primary gap-2"
              type="button"
              disabled={busy || selectedIds.length < 2}
              onClick={compareSelected}
            >
              <Scale size={15} /> {busy ? "Working…" : `Compare ${selectedIds.length || ""}`}
            </button>
          </div>
          {!profiles.length ? (
            <p className="text-xs text-amber-200/80">No business profiles are available. Comparisons can still be saved, but Formation requires a client business profile.</p>
          ) : null}
        </section>
      ) : (
        <p className="text-sm text-slate-500">Your role can view jurisdiction cards but cannot save comparisons.</p>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {jurisdictions.map((jurisdiction) => (
          <JurisdictionCard
            key={jurisdiction.id}
            jurisdiction={jurisdiction}
            selected={selectedIds.includes(jurisdiction.id)}
            onSelect={toggleJurisdiction}
            disabled={!canCompare || busy}
          />
        ))}
      </div>

      {message ? <p role="status" className="text-sm text-slate-300">{message}</p> : null}

      {comparison ? (
        <section className="space-y-4 border-t border-white/10 pt-5" aria-labelledby="comparison-results-heading">
          <header className="section-header">
            <div>
              <h2 id="comparison-results-heading">Comparison results</h2>
              <p>Internal analytical indicators only. Missing observations remain unknown, not zero.</p>
            </div>
            <span className="status-badge status-success">Saved</span>
          </header>
          <div className="overflow-x-auto border-y border-white/10">
            <table className="w-full min-w-[580px] text-left text-sm">
              <thead className="border-b border-white/10 text-xs uppercase text-slate-500">
                <tr><th className="py-3 pr-4">Jurisdiction</th><th className="py-3 px-4">Indicator</th><th className="py-3 px-4">Confidence</th><th className="py-3 pl-4">Review</th></tr>
              </thead>
              <tbody>
                {comparison.results.map((result) => (
                  <tr key={result.jurisdictionId} className="border-b border-white/5 last:border-0">
                    <td className="py-3 pr-4 font-medium text-white">{resultNames.get(result.jurisdictionId) ?? result.jurisdictionId}</td>
                    <td className="px-4 text-cyan-100">{result.analyticalIndicator ?? "Unknown"}</td>
                    <td className="px-4 text-slate-300">{result.confidence}%</td>
                    <td className="pl-4 text-xs text-amber-200">{result.professionalReviewRequired ? "Required" : "Not flagged"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {canCreateFormation ? (
            <div className="grid gap-4 sm:grid-cols-2 sm:items-end">
              <label className="space-y-2 text-sm text-slate-300">
                <span>Working jurisdiction</span>
                <select className="form-input" value={formationJurisdictionId} onChange={(event) => setFormationJurisdictionId(event.target.value)}>
                  {comparison.results.map((result) => (
                    <option key={result.jurisdictionId} value={result.jurisdictionId}>{resultNames.get(result.jurisdictionId) ?? result.jurisdictionId}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm text-slate-300 sm:col-span-2">
                <span>Decision rationale</span>
                <textarea
                  className="form-input min-h-20"
                  value={rationale}
                  onChange={(event) => setRationale(event.target.value)}
                  maxLength={5000}
                  placeholder="Why is this the working jurisdiction for this formation plan?"
                />
              </label>
              <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2">
                {!profileId ? <p className="text-xs text-amber-200/80">Select a business profile before creating a Formation plan.</p> : <span />}
                <button
                  className="button button-primary gap-2"
                  type="button"
                  disabled={busy || !profileId}
                  onClick={createFormationPlan}
                >
                  Continue to Formation <ArrowRight size={15} />
                </button>
              </div>
            </div>
          ) : (
            <Link href="/formation" className="button gap-2">Open Formation <ArrowRight size={15} /></Link>
          )}
        </section>
      ) : null}
    </div>
  );
}
