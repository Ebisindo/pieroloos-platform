"use client";

import { useCallback, useState } from "react";
import { GlassPanel, PageHeader, StatusBadge } from "@/components/ui/primitives";

const permissionOptions = [
  ["DASHBOARD_READ", "Dashboard overview"],
  ["CLIENTS_READ", "Read client records"],
  ["PARTNERSHIP_INQUIRIES_READ", "Read partnership inquiries"],
  ["ADMINS_READ", "Read administrator assignments"],
  ["AUDIT_READ", "Read administrative audit activity"],
] as const;
type Permission = (typeof permissionOptions)[number][0];
const permissionLabels = Object.fromEntries(permissionOptions) as Record<Permission, string>;

type Administrator = {
  id: string;
  createdAt: string;
  user: { id: string; name: string | null };
  permissions: { permission: Permission; createdAt: string }[];
};
type EligibleUser = { id: string; name: string | null };
type AdministratorResponse = { administrators: Administrator[]; eligibleUsers: EligibleUser[] | null };

export function AdministratorManagement({
  initialData,
  canManage,
}: {
  initialData: AdministratorResponse;
  canManage: boolean;
}) {
  const [data, setData] = useState(initialData);
  const [userId, setUserId] = useState("");
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/admin/administrators", { cache: "no-store" });
    if (!response.ok) throw new Error("The administrator list could not be refreshed.");
    const payload: { data: AdministratorResponse } = await response.json();
    setData(payload.data);
  }, []);

  function editAdministrator(administrator: Administrator) {
    setUserId(administrator.user.id);
    setPermissions(administrator.permissions.map(({ permission }) => permission));
    setReason("");
    setMessage("");
    setError("");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const existing = data.administrators.some(({ user }) => user.id === userId);
      const response = await fetch("/api/admin/administrators", {
        method: existing ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId, permissions, reason }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "The administrator change was rejected.");
      await refresh();
      setMessage("Administrator permissions have been saved and reloaded from the server.");
      setReason("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The administrator change could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(administrator: Administrator) {
    if (!window.confirm(`Revoke platform administrator access for ${administrator.user.name || administrator.user.id}?`)) return;
    const decisionReason = window.prompt("Enter a reason for revoking administrator access (at least 8 characters):");
    if (!decisionReason || decisionReason.trim().length < 8) {
      setError("A revocation reason of at least 8 characters is required.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/administrators", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: administrator.user.id, reason: decisionReason }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Administrator access could not be revoked.");
      await refresh();
      setMessage("Administrator access was revoked and the list was reloaded from the server.");
      if (userId === administrator.user.id) setUserId("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Administrator access could not be revoked.");
    } finally {
      setBusy(false);
    }
  }

  function togglePermission(permission: Permission) {
    setPermissions((current) => {
      if (permission === "DASHBOARD_READ" && current.includes(permission)) {
        return current.filter((item) => item !== permission && item !== "CLIENTS_READ" && item !== "AUDIT_READ");
      }
      const next = current.includes(permission)
        ? current.filter((item) => item !== permission)
        : [...current, permission];
      if ((permission === "CLIENTS_READ" || permission === "AUDIT_READ") && next.includes(permission)) {
        return next.includes("DASHBOARD_READ") ? next : [...next, "DASHBOARD_READ"];
      }
      return next;
    });
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="SUPER ADMINISTRATOR"
        title="Administrator management"
        description="Grant ordinary administrators only the individually selected read permissions. Permission changes are audited with a required reason."
      />

      {error ? <p role="alert" className="admin-message admin-message-error">{error}</p> : null}
      {message ? <p role="status" className="admin-message">{message}</p> : null}

      {canManage ? (
        <GlassPanel className="admin-form-panel">
          <h2>Assign or update an administrator</h2>
          <p>Only existing staff accounts with an organization membership are eligible.</p>
          <form onSubmit={submit}>
            <label htmlFor="admin-user">Staff account</label>
            <select id="admin-user" className="form-input" value={userId} onChange={(event) => setUserId(event.target.value)} required>
              <option value="">Select an existing staff member</option>
              {data.eligibleUsers?.map((user) => (
                <option key={user.id} value={user.id}>{user.name || "Unnamed staff"} · {user.id}</option>
              ))}
            </select>
            <fieldset>
              <legend>Delegated permissions</legend>
              {permissionOptions.map(([value, label]) => (
                <label className="admin-permission-option" key={value}>
                  <input type="checkbox" checked={permissions.includes(value)} onChange={() => togglePermission(value)} />
                  <span>{label}</span>
                </label>
              ))}
            </fieldset>
            <label htmlFor="admin-reason">Reason for this change</label>
            <textarea id="admin-reason" className="form-input" value={reason} minLength={8} maxLength={500} onChange={(event) => setReason(event.target.value)} required />
            <div className="page-actions">
              <button className="button button-primary" type="submit" disabled={busy || !userId}>
                {busy ? "Saving…" : "Save permissions"}
              </button>
              <button className="button button-secondary" type="button" disabled={busy} onClick={() => { setUserId(""); setPermissions([]); setReason(""); }}>
                Clear
              </button>
            </div>
          </form>
        </GlassPanel>
      ) : null}

      <section className="page-stack" aria-labelledby="administrator-list-title">
        <h2 id="administrator-list-title">Ordinary administrators</h2>
        {data.administrators.length ? (
          <GlassPanel className="admin-table-wrap">
            <table className="admin-table">
              <caption className="sr-only">Platform ordinary administrators and delegated permissions</caption>
              <thead><tr><th scope="col">Staff member</th><th scope="col">Permissions</th><th scope="col">Since</th>{canManage ? <th scope="col">Actions</th> : null}</tr></thead>
              <tbody>
                {data.administrators.map((administrator) => (
                  <tr key={administrator.id}>
                    <td>{administrator.user.name || "Unnamed staff"}<br /><code>{administrator.user.id}</code></td>
                    <td>{administrator.permissions.length
                      ? administrator.permissions.map(({ permission }) => <span className="admin-permission-chip" key={permission}>{permissionLabels[permission]}</span>)
                      : <StatusBadge>NO PERMISSIONS</StatusBadge>}</td>
                    <td><time dateTime={administrator.createdAt}>{new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(administrator.createdAt))}</time></td>
                    {canManage ? <td>
                      <div className="admin-row-actions">
                        <button className="button button-secondary" type="button" disabled={busy} onClick={() => editAdministrator(administrator)}>Edit</button>
                        <button className="button button-secondary" type="button" disabled={busy} onClick={() => void revoke(administrator)}>Revoke</button>
                      </div>
                    </td> : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </GlassPanel>
        ) : (
          <GlassPanel><p className="admin-note">No ordinary administrators are currently assigned.</p></GlassPanel>
        )}
      </section>
    </div>
  );
}
