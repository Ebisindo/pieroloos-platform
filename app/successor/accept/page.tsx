"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function AcceptSuccessorInvitationPage() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [successorId, setSuccessorId] = useState("");

  async function accept() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/successor/accept", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "This invitation could not be accepted.");
      setSuccessorId(payload.data.successorId); setAccepted(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "This invitation could not be accepted.");
    } finally { setBusy(false); }
  }

  return (
    <main className="mx-auto my-16 max-w-xl rounded-xl border border-slate-700 bg-slate-950 p-7 text-slate-100 shadow-2xl">
      <div className="mb-4 inline-flex items-center gap-2 text-xs uppercase tracking-widest text-slate-400"><span aria-hidden="true">◆</span> PieroloOS · Continuity Vault</div>
      <h1 className="text-2xl font-semibold tracking-tight">Successor invitation</h1>
      {accepted ? (
        <section className="mt-5 space-y-3" role="status">
          <p className="rounded-lg border border-emerald-700 bg-emerald-950/40 p-4 text-sm text-emerald-100">Invitation accepted and recorded.</p>
          <p className="text-sm leading-6 text-slate-300">Your acceptance does not grant SuperAdmin access. The designated owner or authorized reviewer must independently confirm identity and MFA. The verification record is <code>{successorId}</code>.</p>
          <Link className="inline-flex rounded-md border border-slate-700 px-3 py-2 text-sm hover:bg-slate-900" href="/signin">Continue to sign in</Link>
        </section>
      ) : (
        <div className="mt-4 space-y-4">
          <p className="text-sm leading-6 text-slate-400">Accepting this invitation records your willingness to serve as a continuity contact. It does not create a user account, promote your role, grant access to secrets, or transfer ownership.</p>
          {error ? <p role="alert" className="rounded-md border border-red-800 bg-red-950/40 p-3 text-sm text-red-200">{error}</p> : null}
          <button type="button" onClick={() => void accept()} disabled={busy || token.length < 32} className="inline-flex min-h-10 items-center rounded-md border border-emerald-700 bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Recording acceptance…" : "Accept invitation"}</button>
          <p className="text-xs text-slate-500">Invitation links are single-use and expire after seven days. If this link has expired, contact the owner to issue a fresh invitation.</p>
        </div>
      )}
    </main>
  );
}
