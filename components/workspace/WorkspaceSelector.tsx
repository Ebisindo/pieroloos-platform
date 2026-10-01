"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AccessibleWorkspace } from "@/lib/auth/workspace-context";

export function WorkspaceSelector({ workspaces }: { workspaces: AccessibleWorkspace[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function selectWorkspace(workspaceId: string) {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/workspaces/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      });
      if (!response.ok) throw new Error("Workspace selection could not be saved.");
      router.refresh();
    } catch (selectionError) {
      setError(selectionError instanceof Error ? selectionError.message : "Selection failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="glass-panel max-w-2xl p-6">
      <label className="block text-sm font-medium" htmlFor="active-workspace">
        Active workspace
      </label>
      <select
        id="active-workspace"
        className="mt-3 min-h-11 w-full rounded-md border border-white/10 bg-[#0b1128] px-3 text-sm text-white"
        defaultValue=""
        disabled={pending}
        onChange={(event) => void selectWorkspace(event.target.value)}
      >
        <option value="" disabled>Select a workspace</option>
        {workspaces.map((workspace) => (
          <option key={workspace.id} value={workspace.id}>
            {workspace.name} · {workspace.role}
          </option>
        ))}
      </select>
      {error ? <p role="alert" className="mt-3 text-sm text-rose-300">{error}</p> : null}
    </div>
  );
}