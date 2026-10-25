"use client";

import { useState } from "react";
import { Activity, AlertTriangle, ArrowRightLeft, Check, ChevronRight, CircleHelp, Clock3, FileKey2, GitBranch, KeyRound, LockKeyhole, Plus, ShieldCheck, ShieldEllipsis, UserRoundCheck, X } from "lucide-react";

type SuccessorStatus = "PENDING" | "ACCEPTED" | "ACTIVE" | "REVOKED";
type ContinuityCase = { id: string; status: string; createdAt: string; warningSentAt: string | null; reviewRequiredAt: string | null };
type Successor = {
  id: string; successorName: string; successorEmail: string; successorGithub: string | null;
  relationship: string; status: SuccessorStatus; verificationLevel: string; autoActivateAfterDays: number;
  permissions: Record<string, boolean>; lastOwnerActivityAt: string; warningSentAt: string | null; createdAt: string;
  acceptedAt: string | null; idVerifiedAt: string | null; mfaVerifiedAt: string | null;
  highPermissionVerificationNote: string | null; continuityCases: ContinuityCase[];
};
type Asset = { id: string; assetType: string; label: string; recoveryLocation: string; criticality: string; notes: string | null; updatedAt: string };
type Runbook = { id: string; title: string; content: string; version: number; reviewedAt: string | null; updatedAt: string };
type InitialData = { successors: Successor[]; assets: Asset[]; runbooks: Runbook[] };

const permissionOptions = [
  ["canTransferOwnership", "Request ownership transfer", "Requires an independently verified, provider-specific transfer workflow."],
  ["canAccessSecrets", "Request secret access", "Requires identity/video verification and the external vault's own controls."],
  ["canDeploy", "Deploy and rollback", "Operational deployment permissions only; no credentials are copied into PieroloOS."],
  ["canAccessBilling", "Manage billing recovery", "Provider-level recovery remains subject to the provider account's rules."],
] as const;
const statusCopy: Record<SuccessorStatus, string> = { PENDING: "Pending", ACCEPTED: "Accepted", ACTIVE: "Active", REVOKED: "Revoked" };

function timeAgo(value: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  return `${Math.floor(seconds / 86400)} days ago`;
}
function triggerDate(lastActivity: string, days: number) {
  return new Date(new Date(lastActivity).getTime() + days * 86400000);
}
function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
function statusClass(status: SuccessorStatus) {
  if (status === "PENDING") return "continuity-status continuity-status-pending";
  if (status === "ACCEPTED") return "continuity-status continuity-status-accepted";
  if (status === "ACTIVE") return "continuity-status continuity-status-active";
  return "continuity-status continuity-status-revoked";
}

export function SuccessorContinuityVault({ initialData, ownerEmail }: { initialData: InitialData; ownerEmail: string }) {
  const [data, setData] = useState(initialData);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [simulated, setSimulated] = useState<Record<string, unknown> | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [github, setGithub] = useState("");
  const [relationship, setRelationship] = useState("Co-founder");
  const [days, setDays] = useState("60");
  const [permissions, setPermissions] = useState<Record<string, boolean>>({
    canTransferOwnership: false, canAccessSecrets: false, canDeploy: true, canAccessBilling: false,
  });
  const [verificationNote, setVerificationNote] = useState("");
  const [assetType, setAssetType] = useState("GitHub repository");
  const [assetLabel, setAssetLabel] = useState("");
  const [assetLocation, setAssetLocation] = useState("");
  const [assetCriticality, setAssetCriticality] = useState("HIGH");
  const [assetNotes, setAssetNotes] = useState("");
  const [runbookTitle, setRunbookTitle] = useState("");
  const [runbookContent, setRunbookContent] = useState("");
  const [activeTab, setActiveTab] = useState<"successors" | "assets" | "runbook">("successors");

  const activeSuccessor = data.successors.find((item) => item.id === selectedId) ?? data.successors[0] ?? null;
  const lastActivity = data.successors[0]?.lastOwnerActivityAt;
  const inactivityDays = data.successors[0]?.autoActivateAfterDays ?? 60;
  const dueAt = lastActivity ? triggerDate(lastActivity, inactivityDays) : null;
  const hoursOld = lastActivity ? Math.floor((Date.now() - new Date(lastActivity).getTime()) / 3600000) : 0;
  const assetTypes = ["GitHub organization", "GitHub repository", "Domain / DNS", "Vercel project", "Database credential location", "Stripe account", "1Password / Vault", "Object storage", "Backup / restore", "Identity provider", "Monitoring", "Other"];

  async function mutate(payload: Record<string, unknown>) {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/successors", {
        method: payload.action === "create" ? "POST" : "PATCH",
        headers: { "content-type": "application/json" }, body: JSON.stringify(payload.action === "create" ? Object.fromEntries(Object.entries(payload).filter(([key]) => key !== "action")) : payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "The continuity action was rejected.");
      if (payload.action === "create") {
        setNotice(result.warning || "Invitation created.");
      } else if (payload.action === "simulate") {
        setSimulated(result.data as Record<string, unknown>);
        setNotice("Simulation complete. No access or provider state was changed.");
      } else if (payload.action === "alive") {
        setNotice(`Inactivity timer reset at ${formatDate(result.data.resetAt)}.`);
      } else if (payload.action === "revoke") {
        setNotice("Successor access was revoked."); setSelectedId("");
      } else if (payload.action === "asset") {
        setNotice("Asset recovery pointer saved."); setAssetLabel(""); setAssetLocation(""); setAssetNotes("");
      } else if (payload.action === "runbook") {
        setNotice("Emergency runbook saved. Review and test it before relying on it.");
      }
      const refreshed = await fetch("/api/admin/successors", { cache: "no-store" });
      if (refreshed.ok) {
        const body = await refreshed.json();
        setData({
          successors: body.data.successors.map((item: Successor) => ({ ...item, createdAt: String(item.createdAt), lastOwnerActivityAt: String(item.lastOwnerActivityAt) })),
          assets: body.data.assets.map((item: Asset) => ({ ...item, updatedAt: String(item.updatedAt) })),
          runbooks: body.data.runbooks.map((item: Runbook) => ({ ...item, createdAt: String(item.createdAt), updatedAt: String(item.updatedAt) })),
        });
      }
      if (payload.action === "create") {
        setShowForm(false); setName(""); setEmail(""); setGithub(""); setVerificationNote("");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The continuity action could not be completed.");
    } finally { setBusy(false); }
  }

  function togglePermission(key: string) {
    setPermissions((current) => ({ ...current, [key]: !current[key] }));
  }

  return (
    <main className="continuity-vault">
      <div className="continuity-topline"><div className="continuity-lock"><LockKeyhole size={17} aria-hidden="true" /><span>PIEROLOOS / PRIVATE VAULT</span></div><span className="continuity-top-meta"><span className="continuity-dot" />SUPERADMIN ONLY</span></div>
      <header className="continuity-header">
        <div className="continuity-heading-icon"><ShieldCheck size={24} aria-hidden="true" /></div>
        <div className="continuity-title-block">
          <p className="continuity-eyebrow">SETTINGS / BUSINESS CONTINUITY</p>
          <h1>Legacy &amp; Successor Protocol</h1>
          <p className="continuity-subtitle">Who owns your code when you are not here?</p>
        </div>
        <button className="continuity-primary-button" type="button" onClick={() => { setShowForm((open) => !open); setError(""); }} disabled={busy}><Plus size={16} /> Add Successor</button>
      </header>

      <section className="continuity-summary" aria-label="Continuity protocol status">
        <div className="continuity-summary-symbol"><Activity size={19} aria-hidden="true" /></div>
        <div className="continuity-summary-copy">
          <strong>Dead-man switch</strong>
          <span>Last activity: {lastActivity ? timeAgo(lastActivity) : "not yet recorded"}. Handover review would trigger after {inactivityDays} days of inactivity.</span>
        </div>
        <button type="button" className="continuity-quiet-button" disabled={busy} onClick={() => void mutate({ action: "alive" })}><Check size={15} /> I’m Alive</button>
      </section>

      {error ? <div className="continuity-message continuity-error" role="alert"><AlertTriangle size={17} />{error}</div> : null}
      {notice ? <div className="continuity-message continuity-notice" role="status"><Check size={17} />{notice}</div> : null}

      {showForm ? (
        <section className="continuity-card continuity-form-card" aria-labelledby="new-successor-heading">
          <div className="continuity-card-header"><div><h2 id="new-successor-heading">Add a successor</h2><p>An invitation is not an active admin grant. Identity verification and 2FA are separate checks.</p></div><button className="continuity-icon-button" aria-label="Close form" type="button" onClick={() => setShowForm(false)}><X size={17} /></button></div>
          <form onSubmit={(event) => { event.preventDefault(); void mutate({ action: "create", successorName: name, successorEmail: email, successorGithub: github, relationship, autoActivateAfterDays: Number(days), permissions, highPermissionVerificationNote: verificationNote }); }}>
            <div className="continuity-form-grid">
              <label>Name<input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={120} placeholder="Full legal name" /></label>
              <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={254} placeholder="successor@company.com" /></label>
              <label>GitHub username <span className="continuity-optional">Optional</span><div className="continuity-input-prefix"><span>@</span><input value={github} onChange={(e) => setGithub(e.target.value.replace(/^@/, ""))} maxLength={39} placeholder="github-handle" /></div></label>
              <label>Relationship<select value={relationship} onChange={(e) => setRelationship(e.target.value)}><option>Co-founder</option><option>CTO</option><option>Business partner</option><option>Spouse</option><option>Sibling</option><option>Family member</option><option>Trusted advisor</option><option>Other</option></select></label>
            </div>
            <label className="continuity-field-full">Inactivity trigger<select value={days} onChange={(e) => setDays(e.target.value)}><option value="30">30 days</option><option value="60">60 days</option><option value="90">90 days</option></select><span className="continuity-help">Seven days before the trigger, the system should send a warning and open a review window. Inactivity alone does not establish incapacity or grant access.</span></label>
            <fieldset className="continuity-permission-fieldset"><legend>Continuity permissions</legend><p>Start with least privilege. Provider access is never granted from a UI checkbox alone.</p>
              <div className="continuity-permission-list">{permissionOptions.map(([key, label, description]) => <label className="continuity-permission-row" key={key}><input type="checkbox" checked={Boolean(permissions[key])} onChange={() => togglePermission(key)} /><span className="continuity-permission-text"><strong>{label}</strong><small>{description}</small></span></label>)}</div>
            </fieldset>
            {permissions.canAccessSecrets ? <label className="continuity-field-full">Verification plan for secrets access<textarea value={verificationNote} onChange={(e) => setVerificationNote(e.target.value)} minLength={8} maxLength={1000} required placeholder="Describe the independent video/ID verification process and evidence storage location. Do not enter secret values."/><span className="continuity-help">This records the verification plan only; secret access remains blocked until the evidence and vault controls are independently verified.</span></label> : null}
            <div className="continuity-form-footer"><span><LockKeyhole size={14} /> Changes require a fresh authentication / MFA check.</span><button type="submit" className="continuity-primary-button" disabled={busy}>{busy ? "Saving…" : "Create invitation"}</button></div>
          </form>
        </section>
      ) : null}

      <div className="continuity-tabs" role="tablist" aria-label="Continuity sections">
        <button type="button" role="tab" aria-selected={activeTab === "successors"} className={activeTab === "successors" ? "is-active" : ""} onClick={() => setActiveTab("successors")}>Successors <span>{data.successors.filter((item) => item.status !== "REVOKED").length}</span></button>
        <button type="button" role="tab" aria-selected={activeTab === "assets"} className={activeTab === "assets" ? "is-active" : ""} onClick={() => setActiveTab("assets")}>Critical assets <span>{data.assets.length}</span></button>
        <button type="button" role="tab" aria-selected={activeTab === "runbook"} className={activeTab === "runbook" ? "is-active" : ""} onClick={() => setActiveTab("runbook")}>Emergency runbook <span>{data.runbooks.length}</span></button>
      </div>

      {activeTab === "successors" ? <section className="continuity-card">
        <div className="continuity-card-header"><div><h2>Successor roster</h2><p>Document who can maintain the company if the primary owner is unavailable.</p></div><span className="continuity-roster-count">{data.successors.length} record{data.successors.length === 1 ? "" : "s"}</span></div>
        {data.successors.length ? <div className="continuity-roster">{data.successors.map((item) => <article key={item.id} className={`continuity-successor-row ${selectedId === item.id ? "is-selected" : ""}`}>
          <button type="button" className="continuity-successor-main" onClick={() => { setSelectedId(item.id); setSimulated(null); }} aria-pressed={selectedId === item.id}>
            <span className="continuity-avatar"><UserRoundCheck size={19} /></span>
            <span className="continuity-identity"><strong>{item.successorName}</strong><span>{item.successorEmail}</span><small>{item.relationship}{item.successorGithub ? ` · @${item.successorGithub}` : ""}</small></span>
            <span className={statusClass(item.status)}>{item.status === "ACTIVE" ? <AlertTriangle size={12} /> : item.status === "ACCEPTED" ? <Check size={12} /> : null}{statusCopy[item.status]}</span>
            <ChevronRight size={17} className="continuity-chevron" />
          </button>
          {selectedId === item.id ? <div className="continuity-successor-detail">
            <div className="continuity-detail-grid"><div><small>Inactivity trigger</small><strong>{item.autoActivateAfterDays} days</strong></div><div><small>Last owner heartbeat</small><strong>{timeAgo(item.lastOwnerActivityAt)}</strong></div><div><small>Email / identity</small><strong>{item.verificationLevel === "ID_VERIFIED" ? "Identity verified" : item.acceptedAt ? "Invite accepted · ID pending" : "Invitation not accepted"}</strong></div><div><small>MFA evidence</small><strong>{item.mfaVerifiedAt ? "Recorded" : "Not verified"}</strong></div></div>
            <div className="continuity-permission-chips">{permissionOptions.map(([key, label]) => <span key={key} className={item.permissions[key] ? "is-enabled" : ""}><span>{item.permissions[key] ? "✓" : "—"}</span>{label}</span>)}</div>
            {item.highPermissionVerificationNote ? <p className="continuity-help">A verification plan is recorded. Actual identity/video verification still needs evidence review.</p> : null}
            {item.continuityCases.length ? <p className="continuity-help">Latest continuity case: {item.continuityCases[0].status.replaceAll("_", " ").toLowerCase()}.</p> : null}
            <div className="continuity-row-actions"><button type="button" className="continuity-secondary-button" disabled={busy} onClick={() => void mutate({ action: "simulate", successorId: item.id })}><Activity size={14} /> Simulate Handover</button>{item.status !== "REVOKED" && item.status !== "ACTIVE" ? <button type="button" className="continuity-danger-button" disabled={busy} onClick={() => { const reason = window.prompt("Why are you revoking this successor? (At least 8 characters)"); if (reason && reason.trim().length >= 8) void mutate({ action: "revoke", successorId: item.id, reason }); else if (reason) setError("Enter a revocation reason of at least 8 characters."); }}><X size={14} /> Revoke Access</button> : null}</div>
          </div> : null}
        </article>)}</div> : <div className="continuity-empty"><div className="continuity-empty-icon"><ShieldEllipsis size={22} /></div><strong>No successor configured</strong><p>Business continuity currently depends on the primary owner. Add and independently verify a trusted successor to begin.</p><button className="continuity-secondary-button" type="button" onClick={() => setShowForm(true)}><Plus size={15} /> Add first successor</button></div>}
      </section> : null}

      {activeTab === "assets" ? <section className="continuity-card">
        <div className="continuity-card-header"><div><h2>Critical assets</h2><p>Recovery pointers only. Never paste credentials, API keys, tokens, or recovery codes here.</p></div></div>
        <form className="continuity-asset-form" onSubmit={(event) => { event.preventDefault(); void mutate({ action: "asset", asset: { assetType, label: assetLabel, recoveryLocation: assetLocation, criticality: assetCriticality, notes: assetNotes } }); }}>
          <div className="continuity-form-grid"><label>Asset category<select value={assetType} onChange={(e) => setAssetType(e.target.value)}>{assetTypes.map((value) => <option key={value}>{value}</option>)}</select></label><label>Asset name / identifier<input value={assetLabel} onChange={(e) => setAssetLabel(e.target.value)} required maxLength={160} placeholder="pieroloos-platform" /></label><label>Recovery location<input value={assetLocation} onChange={(e) => setAssetLocation(e.target.value)} required maxLength={500} placeholder="Vault item, owner account, recovery URL" /></label><label>Criticality<select value={assetCriticality} onChange={(e) => setAssetCriticality(e.target.value)}><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option></select></label></div>
          <label>Operational note <span className="continuity-optional">Optional</span><textarea value={assetNotes} onChange={(e) => setAssetNotes(e.target.value)} maxLength={1000} placeholder="Recovery dependencies, escalation contact, last review date. No secret values." /></label>
          <button className="continuity-secondary-button" type="submit" disabled={busy}><Plus size={15} /> Record recovery pointer</button>
        </form>
        {data.assets.length ? <div className="continuity-asset-list">{data.assets.map((asset) => <article key={asset.id} className="continuity-asset-row"><span className="continuity-asset-icon"><FileKey2 size={18} /></span><div><strong>{asset.label}</strong><small>{asset.assetType} · {asset.criticality} priority</small><p>{asset.recoveryLocation}</p>{asset.notes ? <small>{asset.notes}</small> : null}</div><span className="continuity-asset-updated">{formatDate(asset.updatedAt)}</span></article>)}</div> : <div className="continuity-inline-empty"><GitBranch size={18} /><span>No asset recovery pointers recorded. Begin with source control, domains, hosting, databases and the secret manager.</span></div>}
        <div className="continuity-transmission-note"><KeyRound size={17} /><div><strong>Transmission package</strong><p>At activation review, PieroloOS can assemble this inventory and your runbooks into a manifest. Encrypted notes stay disabled until a production KMS envelope-encryption adapter is configured.</p></div></div>
      </section> : null}

      {activeTab === "runbook" ? <section className="continuity-card">
        <div className="continuity-card-header"><div><h2>Emergency runbook</h2><p>Write operational instructions that a verified operator can follow without needing the founder's memory.</p></div></div>
        <form className="continuity-runbook-form" onSubmit={(event) => { event.preventDefault(); void mutate({ action: "runbook", runbook: { title: runbookTitle, content: runbookContent } }); }}>
          <label>Runbook title<input value={runbookTitle} onChange={(e) => setRunbookTitle(e.target.value)} required maxLength={160} placeholder="Production deployment and rollback" /></label>
          <label>Recovery procedure<textarea value={runbookContent} onChange={(e) => setRunbookContent(e.target.value)} required minLength={20} maxLength={20000} rows={9} placeholder={"1. Verify incident and contact the designated operator.\n2. Locate the approved deployment workflow.\n3. Confirm backup freshness and recovery point.\n4. Deploy a reviewed commit.\n5. Validate health checks and customer-facing flows.\n6. Roll back using the last known-good release if validation fails.\n7. Record evidence and notify stakeholders.\n\nDocument where the vault lives; do not paste passwords, tokens, private keys, or recovery codes."} /></label>
          <button className="continuity-primary-button" type="submit" disabled={busy}>Save runbook</button>
        </form>
        {data.runbooks.length ? <div className="continuity-runbook-list"><h3>Saved procedures</h3>{data.runbooks.map((item) => <article key={item.id}><div><strong>{item.title}</strong><small>Version {item.version} · Updated {formatDate(item.updatedAt)}</small></div><button className="continuity-secondary-button" type="button" onClick={() => { setRunbookTitle(item.title); setRunbookContent(item.content); setNotice("Runbook loaded for editing. Saving will create a new version."); }}>Load to edit</button></article>)}</div> : <div className="continuity-inline-empty"><CircleHelp size={18} /><span>No emergency procedures saved. Add clear deploy, rollback, database restore, DNS, and incident-contact steps.</span></div>}
        <div className="continuity-transmission-note"><ArrowRightLeft size={17} /><div><strong>Encrypted owner note</strong><p>This implementation intentionally does not accept or store plaintext legacy notes. Configure a KMS-backed envelope-encryption service before exposing note authoring or release.</p></div></div>
      </section> : null}

      {dueAt && activeSuccessor ? <section className="continuity-footer-card"><div className="continuity-footer-icon"><Clock3 size={18} /></div><div><strong>Next inactivity review estimate</strong><p>{formatDate(dueAt)} — based on the most recently configured successor trigger. Any owner activity resets the heartbeat. This is not evidence of death or incapacity.</p></div><span className="continuity-utc-tag">LOCAL TIME</span></section> : null}

      <section className="continuity-safety"><LockKeyhole size={15} /><p><strong>Safety boundary.</strong> A handover simulation is read-only. Inactivity alone never transfers legal ownership, repository control, billing accounts, deployment secrets, or the SuperAdmin singleton. Those actions need independent verification, current authority checks, provider-specific APIs, and an auditable approval record.</p></section>

      {simulated ? <div className="continuity-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setSimulated(null); }}><section role="dialog" aria-modal="true" aria-labelledby="simulate-title" className="continuity-modal"><div className="continuity-modal-header"><div className="continuity-modal-symbol"><Activity size={20} /></div><button type="button" aria-label="Close simulation results" className="continuity-icon-button" onClick={() => setSimulated(null)}><X size={17} /></button></div><h2 id="simulate-title">Handover simulation</h2><p>This is a dry-run assessment of the configured protocol. No administrative access, ownership, billing, or secret permissions were changed.</p><dl className="continuity-simulation-results">{Object.entries(simulated).map(([key, value]) => <div key={key}><dt>{key.replaceAll(/([A-Z])/g, " $1").replaceAll("_", " ")}</dt><dd>{typeof value === "object" ? JSON.stringify(value, null, 2) : String(value)}</dd></div>)}</dl><button type="button" className="continuity-primary-button" onClick={() => setSimulated(null)}>Close report</button></section></div> : null}
      <footer className="continuity-bottomline"><span><LockKeyhole size={13} /> End-to-end control requires provider-level verification.</span><span>Signed in as {ownerEmail}</span></footer>
    </main>
  );
}
