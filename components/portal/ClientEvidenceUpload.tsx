"use client";

import { useState } from "react";

function sha256Hex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function ClientEvidenceUpload({ clientId }: { clientId: string }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const form = event.currentTarget;
    const file = form.elements.namedItem("file");
    if (!(file instanceof HTMLInputElement) || !file.files?.[0]) {
      setMessage("Choose a file to upload.");
      return;
    }

    setBusy(true);
    try {
      const selected = file.files[0];
      const checksum = sha256Hex(await crypto.subtle.digest("SHA-256", await selected.arrayBuffer()));
      const body = new FormData();
      body.set("file", selected);
      body.set("sha256", checksum);
      const response = await fetch(`/api/portal/clients/${encodeURIComponent(clientId)}/documents`, {
        method: "POST",
        body,
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Evidence upload failed.");
      setMessage("Upload received and quarantined for security scanning.");
      form.reset();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Evidence upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-white/10 bg-white/[0.025] p-4">
      <label className="block text-sm font-medium text-white" htmlFor={`portal-file-${clientId}`}>
        Upload requested evidence
      </label>
      <input
        id={`portal-file-${clientId}`}
        name="file"
        type="file"
        required
        accept=".pdf,.jpg,.jpeg,.png,.txt,.docx"
        className="block w-full text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-300/10 file:px-3 file:py-2 file:text-cyan-100"
      />
      <button type="submit" disabled={busy} className="rounded-lg bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50">
        {busy ? "Uploading…" : "Upload evidence"}
      </button>
      {message ? <p role="status" className="text-sm text-slate-300">{message}</p> : null}
      <p className="text-xs text-slate-500">Uploads are quarantined until the professional workspace’s security scanner approves them.</p>
    </form>
  );
}
