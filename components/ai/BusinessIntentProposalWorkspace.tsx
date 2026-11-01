"use client";

import { useState, type FormEvent } from "react";
import type { BusinessIntentProposal } from "@/lib/domain/business-intent-proposal";

type Decision = "APPROVED" | "REJECTED" | "CHANGES_REQUESTED";
type EvidenceReference = { id: string; statement: string; sourceUrl: string | null; evidenceClass: string; retrievedAt: string | null };
export type ProposalRecord = {
  id: string; clientId: string | null; clientName: string | null; createdByUserId: string;
  reviewedByUserId: string | null; status: string; version: number;
  proposal: BusinessIntentProposal; evidenceReferences: EvidenceReference[];
  provider: string | null; providerModel: string | null; reviewNote: string | null;
  reviewedAt: string | null; createdAt: string; updatedAt: string;
};
type ClientOption = { id: string; name: string };
type Props = { initialProposals: ProposalRecord[]; clients: ClientOption[]; currentUserId: string;
  canCreate: boolean; canReview: boolean; workspaceName: string };

const choices: Array<{ value: Decision; label: string }> = [
  { value: "CHANGES_REQUESTED", label: "Request changes" },
  { value: "APPROVED", label: "Approve for the next controlled step" },
  { value: "REJECTED", label: "Reject proposal" },
];
const inputClass = "mt-1 w-full rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/15";
const labelClass = "block text-sm font-medium text-slate-200";
const panelClass = "rounded-2xl border border-white/10 bg-slate-950/40 p-4 sm:p-5";

export function BusinessIntentProposalWorkspace({ initialProposals, clients, currentUserId, canCreate, canReview, workspaceName }: Props) {
  const [proposals, setProposals] = useState(initialProposals);
  const [businessName, setBusinessName] = useState("");
  const [objective, setObjective] = useState("");
  const [industry, setIndustry] = useState("");
  const [homeJurisdiction, setHomeJurisdiction] = useState("");
  const [markets, setMarkets] = useState("");
  const [clientId, setClientId] = useState("");
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [decision, setDecision] = useState<Record<string, Decision>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [reviewErrors, setReviewErrors] = useState<Record<string, string>>({});
  const [reviewing, setReviewing] = useState<string | null>(null);

  async function createProposal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setCreating(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/ai/business-intent/proposals", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          businessName: businessName.trim(), businessObjective: objective.trim(),
          industry: industry.trim() || undefined, homeJurisdiction: homeJurisdiction.trim(),
          targetMarkets: markets.split(",").map((value) => value.trim()).filter(Boolean),
          clientId: clientId || undefined, constraints: [], knownFacts: [],
        }),
      });
      const payload = await response.json().catch(() => null) as { data?: Record<string, unknown>; error?: string } | null;
      if (!response.ok || !payload?.data) { setError(payload?.error ?? "The proposal could not be created."); return; }
      window.location.reload();
    } catch {
      setError("The proposal service could not be reached. Try again.");
    } finally { setCreating(false); }
  }

  async function reviewProposal(event: FormEvent<HTMLFormElement>, item: ProposalRecord) {
    event.preventDefault();
    const note = (notes[item.id] ?? "").trim();
    const selected = decision[item.id] ?? "CHANGES_REQUESTED";
    if (note.length < 4) { setReviewErrors((old) => ({ ...old, [item.id]: "Add a rationale of at least four characters." })); return; }
    setReviewing(item.id); setReviewErrors((old) => ({ ...old, [item.id]: "" }));
    try {
      const response = await fetch("/api/ai/business-intent/proposals/" + encodeURIComponent(item.id) + "/review", {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision: selected, note, expectedVersion: item.version }),
      });
      const payload = await response.json().catch(() => null) as { data?: Partial<ProposalRecord>; error?: string } | null;
      if (response.status === 409) {
        setReviewErrors((old) => ({ ...old, [item.id]: payload?.error ?? "Proposal changed. Reload and review the latest version." }));
        return;
      }
      if (!response.ok || !payload?.data) {
        setReviewErrors((old) => ({ ...old, [item.id]: payload?.error ?? "Review could not be saved." })); return;
      }
      setMessage("Review saved. The proposal version and audit history were updated.");
      window.location.reload();
    } catch {
      setReviewErrors((old) => ({ ...old, [item.id]: "The review service could not be reached. Try again." }));
    } finally { setReviewing(null); }
  }

  return <div className="space-y-6">
    <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:flex sm:items-center sm:justify-between">
      <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/65">Active workspace</p><p className="mt-1 font-semibold text-white">{workspaceName}</p></div>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300 sm:mt-0">A recorded approval is a workflow decision only. It does not authorize incorporation, filing, payment or any external action.</p>
    </section>
    {message ? <p role="status" className="rounded-xl border border-emerald-300/20 bg-emerald-300/[0.05] p-3 text-sm text-emerald-100">{message}</p> : null}
    {canCreate ? <section className={panelClass} aria-labelledby="intent-create-title">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/65">01 / Define intent</p>
      <h2 id="intent-create-title" className="mt-1 text-xl font-semibold text-white">Create a planning proposal</h2>
      <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">AI output is an unapproved planning draft for human assessment, not legal, tax, accounting or financial advice.</p>
      <form onSubmit={createProposal} className="mt-5 grid gap-4 md:grid-cols-2">
        <div><label className={labelClass} htmlFor="intent-business-name">Business or project name</label><input id="intent-business-name" className={inputClass} value={businessName} onChange={(e) => setBusinessName(e.target.value)} minLength={2} maxLength={200} required /></div>
        <div><label className={labelClass} htmlFor="intent-home-jurisdiction">Home jurisdiction or operating base</label><input id="intent-home-jurisdiction" className={inputClass} value={homeJurisdiction} onChange={(e) => setHomeJurisdiction(e.target.value)} minLength={2} maxLength={200} placeholder="e.g. Nigeria" required /></div>
        <div><label className={labelClass} htmlFor="intent-industry">Industry (optional)</label><input id="intent-industry" className={inputClass} value={industry} onChange={(e) => setIndustry(e.target.value)} maxLength={200} placeholder="e.g. logistics or software" /></div>
        <div><label className={labelClass} htmlFor="intent-markets">Target markets (comma-separated)</label><input id="intent-markets" className={inputClass} value={markets} onChange={(e) => setMarkets(e.target.value)} placeholder="e.g. Nigeria, Ghana, United Kingdom" /></div>
        {clients.length > 0 ? <div className="md:col-span-2"><label className={labelClass} htmlFor="intent-client">Associate workspace client (optional)</label><select id="intent-client" className={inputClass} value={clientId} onChange={(e) => setClientId(e.target.value)}><option value="">No client selected</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></div> : null}
        <div className="md:col-span-2"><label className={labelClass} htmlFor="intent-objective">Business objective and intended outcome</label><textarea id="intent-objective" className={inputClass + " min-h-32 resize-y"} value={objective} onChange={(e) => setObjective(e.target.value)} minLength={10} maxLength={4000} required placeholder="What should the business do, who will it serve, and what would success look like?" /></div>
        {error ? <p role="alert" className="md:col-span-2 text-sm text-rose-100">{error}</p> : null}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between md:col-span-2"><p className="max-w-2xl text-xs leading-5 text-slate-500">Do not enter passwords, bank credentials, national identity numbers or other unnecessary sensitive information. Facts provided here are not independently verified.</p><button type="submit" disabled={creating} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-cyan-200/30 bg-cyan-200/10 px-4 py-2.5 text-sm font-semibold text-cyan-50 hover:bg-cyan-200/15 disabled:opacity-60">{creating ? "Generating…" : "Generate unapproved draft"}</button></div>
      </form>
    </section> : <section className={panelClass}><h2 className="font-semibold text-white">Proposal creation restricted</h2><p className="mt-2 text-sm text-slate-400">Your workspace role cannot generate proposals. Ask an owner or administrator to review your access.</p></section>}
    <section className="space-y-4" aria-labelledby="intent-saved-title">
      <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-100/65">02 / Review and control</p><h2 id="intent-saved-title" className="mt-1 text-xl font-semibold text-white">Saved proposals</h2><p className="mt-1 text-sm text-slate-400">Latest {proposals.length} workspace-scoped proposals. Review decisions are tied to the exact version displayed.</p></div>
      {proposals.length === 0 ? <div className={panelClass}><h3 className="font-semibold text-white">No proposals yet</h3><p className="mt-2 text-sm text-slate-400">Create a business-intent draft to surface assumptions, evidence gaps, entity options and risk scenarios.</p></div> : proposals.map((item) => {
        const final = item.status === "APPROVED" || item.status === "REJECTED";
        const selfReview = item.createdByUserId === currentUserId;
        return <article key={item.id} className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/35">
          <div className="border-b border-white/10 p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-xs font-semibold text-slate-200">{item.status.replaceAll("_", " ")}</span><span className="text-xs text-slate-500">Version {item.version}</span><span className="text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()}</span></div><h3 className="mt-3 text-lg font-semibold text-white">{item.proposal.businessSummary}</h3><p className="mt-2 text-sm leading-6 text-slate-300">{item.proposal.complexityRationale}</p></div><div className="rounded-xl border border-white/10 bg-white/[0.025] px-3 py-2"><p className="text-xs uppercase tracking-wide text-slate-500">Complexity</p><p className="mt-1 text-sm font-semibold text-slate-200">{item.proposal.complexity}</p></div></div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-white/[0.025] p-3"><p className="text-xs uppercase tracking-wide text-slate-500">Client scope</p><p className="mt-1 break-words text-sm text-slate-200">{item.clientId ? item.clientName ?? "Linked client (name restricted)" : "Workspace proposal"}</p></div><div className="rounded-xl bg-white/[0.025] p-3"><p className="text-xs uppercase tracking-wide text-slate-500">Provider</p><p className="mt-1 break-words text-sm text-slate-200">{item.provider ?? "Not recorded"}{item.providerModel ? " · " + item.providerModel : ""}</p></div><div className="rounded-xl bg-white/[0.025] p-3"><p className="text-xs uppercase tracking-wide text-slate-500">Evidence references</p><p className="mt-1 text-sm text-slate-200">{item.evidenceReferences.length} supplied</p></div></div>
          </div>
          <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-2">
            <div><h4 className="text-sm font-semibold text-white">Proposed entities</h4><ul className="mt-2 space-y-2">{item.proposal.proposedEntities.slice(0, 8).map((entity) => <li key={entity.key} className="rounded-xl border border-white/10 p-3"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm text-slate-100">{entity.label}</strong><span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-xs text-slate-400">{entity.category.replaceAll("_", " ")}</span></div><p className="mt-1 text-sm leading-5 text-slate-400">{entity.purpose}</p>{entity.jurisdictionSuggestion ? <p className="mt-1 text-xs text-slate-500">Suggested jurisdiction context: {entity.jurisdictionSuggestion} (unverified)</p> : null}</li>)}</ul></div>
            <div><h4 className="text-sm font-semibold text-white">Facts to verify</h4>{item.proposal.missingFacts.length + item.proposal.evidenceGaps.length === 0 ? <p className="mt-2 text-sm text-slate-500">No gaps were returned. This does not prove all facts are complete.</p> : <ul className="mt-2 space-y-2 text-sm leading-5 text-slate-300">{[...item.proposal.missingFacts, ...item.proposal.evidenceGaps].slice(0, 8).map((fact, index) => <li key={index} className="rounded-xl border border-amber-200/10 bg-amber-200/[0.025] px-3 py-2">{fact}</li>)}</ul>}</div>
          </div>
          <details className="border-t border-white/10 px-4 py-3 sm:px-5"><summary className="cursor-pointer select-none text-sm font-semibold text-cyan-100">Assumptions, relationships, risks and supplied references</summary><div className="mt-4 grid gap-5 lg:grid-cols-2"><div><h4 className="text-sm font-semibold text-white">Assumptions</h4><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">{item.proposal.assumptions.slice(0, 10).map((value, index) => <li key={index}>{value}</li>)}</ul><h4 className="mt-4 text-sm font-semibold text-white">Proposed relationships</h4><ul className="mt-2 space-y-2 text-sm text-slate-300">{item.proposal.proposedRelationships.slice(0, 10).map((rel, index) => <li key={index} className="rounded-lg border border-white/10 p-2"><span className="font-medium text-slate-100">{rel.fromKey}</span><span className="px-2 text-slate-500">→ {rel.relationshipType} →</span><span className="font-medium text-slate-100">{rel.toKey}</span><p className="mt-1 text-slate-400">{rel.rationale}</p></li>)}</ul></div><div><h4 className="text-sm font-semibold text-white">Risk scenarios</h4><ul className="mt-2 space-y-2">{item.proposal.riskScenarios.slice(0, 8).map((risk, index) => <li key={risk.title + index} className="rounded-xl border border-white/10 p-3"><div className="flex items-start justify-between gap-3"><strong className="text-sm text-slate-100">{risk.title}</strong><span className="text-xs text-amber-100/80">{risk.severity}</span></div><p className="mt-1 text-sm leading-5 text-slate-300">{risk.scenario}</p>{risk.needsProfessionalReview ? <p className="mt-2 text-xs text-amber-100/75">Requires qualified professional review</p> : null}</li>)}</ul><h4 className="mt-4 text-sm font-semibold text-white">Source references as supplied</h4>{item.evidenceReferences.length === 0 ? <p className="mt-2 text-sm text-slate-500">No source references were submitted.</p> : <ul className="mt-2 space-y-2">{item.evidenceReferences.slice(0, 10).map((reference) => <li key={reference.id} className="rounded-xl border border-white/10 p-3"><p className="text-sm text-slate-200">{reference.statement}</p><div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500"><span>Claimed class: {reference.evidenceClass}</span>{reference.retrievedAt ? <span>Claimed retrieval: {reference.retrievedAt}</span> : null}{reference.sourceUrl?.startsWith("https://") ? <a className="underline decoration-white/30 underline-offset-2 hover:text-cyan-100" href={reference.sourceUrl} target="_blank" rel="noopener noreferrer">Open source</a> : null}</div></li>)}</ul>}<h4 className="mt-4 text-sm font-semibold text-white">Advisor brief</h4><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">{item.proposal.advisorBrief}</p></div></div><p className="mt-4 rounded-xl border border-amber-200/15 bg-amber-100/[0.03] p-3 text-xs leading-5 text-amber-100/80">Provenance boundary: source references and evidence classes are shown as supplied. This screen does not verify retrieval, source authority, evidence ownership or legal effect. Verify evidence and obtain qualified review before relying on the proposal.</p></details>
          {item.reviewNote ? <div className="border-t border-white/10 bg-white/[0.02] px-4 py-3 sm:px-5"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Latest review note</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-300">{item.reviewNote}</p></div> : null}
          <div className="border-t border-white/10 p-4 sm:px-5">{final ? <p className="text-sm text-slate-400">This proposal is {item.status.toLowerCase()} and cannot be amended by another review. Create a new proposal to reconsider the decision.</p> : !canReview ? <p className="text-sm text-slate-400">Review controls require an authorized owner, administrator or advisor with formation write permission.</p> : selfReview ? <p className="text-sm text-amber-100/80">Independent review required: the proposal creator cannot review their own proposal.</p> : <form onSubmit={(event) => reviewProposal(event, item)} className="grid gap-3 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.4fr)_auto] lg:items-end"><div><label className={labelClass} htmlFor={"review-decision-" + item.id}>Decision</label><select id={"review-decision-" + item.id} className={inputClass} value={decision[item.id] ?? "CHANGES_REQUESTED"} onChange={(e) => setDecision((old) => ({ ...old, [item.id]: e.target.value as Decision }))}>{choices.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div><div><label className={labelClass} htmlFor={"review-note-" + item.id}>Review rationale</label><textarea id={"review-note-" + item.id} className={inputClass + " min-h-20 resize-y"} value={notes[item.id] ?? ""} onChange={(e) => setNotes((old) => ({ ...old, [item.id]: e.target.value }))} minLength={4} maxLength={3000} required placeholder="Record evidence reviewed, limitations and rationale." /></div><button type="submit" disabled={reviewing === item.id} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-violet-200/25 bg-violet-200/10 px-4 py-2.5 text-sm font-semibold text-violet-50 hover:bg-violet-200/15 disabled:opacity-60">{reviewing === item.id ? "Saving…" : "Record review"}</button>{reviewErrors[item.id] ? <div className="flex flex-col gap-2 lg:col-span-3 sm:flex-row sm:items-center sm:justify-between"><p role="alert" className="text-sm text-rose-100">{reviewErrors[item.id]}</p>{reviewErrors[item.id].includes("version") || reviewErrors[item.id].includes("changed") ? <button type="button" className="text-sm font-semibold text-cyan-100 underline underline-offset-4" onClick={() => window.location.reload()}>Reload latest version</button> : null}</div> : null}</form>}</div>
        </article>;
      })}
    </section>
  </div>;
}
