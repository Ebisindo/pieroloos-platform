"use client";

import { useState } from "react";

type Institution = {
  id: string;
  officialName: string;
  acronym: string | null;
  countryCode: string | null;
  category: string;
  scope: string;
  relationshipStatus: string;
  verificationStatus: string;
  officialWebsite: string | null;
  createdAt: string;
  evidence: Array<{ id: string; sourceTitle: string; evidenceClass: string; verifiedAt: string | null }>;
};

const categories = [
  ["NATIONAL_EXPORT_PROMOTION", "National export-promotion agency"],
  ["TRADE_MINISTRY", "Trade ministry"],
  ["EXPORT_DEVELOPMENT", "Export-development organization"],
  ["INTERNATIONAL_TRADE_DEPARTMENT", "International trade department"],
  ["INVESTMENT_TRADE_PROMOTION", "Investment and trade-promotion agency"],
  ["CHAMBER_INDUSTRY_ORGANIZATION", "Chamber or industry organization"],
  ["REGIONAL_TRADE_BODY", "Regional trade body"],
  ["MULTILATERAL_TRADE_SUPPORT", "Multilateral trade-support institution"],
  ["OTHER", "Other"],
];

export function ExportInstitutionDirectory({ initialData }: { initialData: Institution[] }) {
  const [institutions, setInstitutions] = useState(initialData);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [officialName, setOfficialName] = useState("");
  const [category, setCategory] = useState("NATIONAL_EXPORT_PROMOTION");
  const [scope, setScope] = useState("NATIONAL");
  const [countryCode, setCountryCode] = useState("");
  const [officialWebsite, setOfficialWebsite] = useState("");
  const [mandateSummary, setMandateSummary] = useState("");

  async function reload() {
    const response = await fetch("/api/admin/institutions", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Unable to refresh directory.");
    setInstitutions(result.data);
  }

  async function createInstitution(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/admin/institutions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          officialName, category, scope,
          countryCode: countryCode || undefined,
          officialWebsite: officialWebsite || undefined,
          mandateSummary: mandateSummary || undefined,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to create institutional record.");
      await reload();
      setOfficialName("");
      setCountryCode("");
      setOfficialWebsite("");
      setMandateSummary("");
      setNotice("Institution added as Prospective — Not Confirmed. No public profile or endorsement has been authorized.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to create institutional record.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-stack">
      <section className="glass-panel page-stack" aria-labelledby="institution-create-title">
        <div>
          <h2 id="institution-create-title">Add a prospective institution</h2>
          <p>New records are private and unconfirmed. Add evidence through the secured institutional evidence API before relying on institutional claims.</p>
        </div>
        <form className="form-grid" onSubmit={createInstitution}>
          <label className="form-field">Official institution name
            <input required minLength={2} maxLength={200} value={officialName} onChange={(e) => setOfficialName(e.target.value)} />
          </label>
          <label className="form-field">Institution category
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="form-field">Institutional scope
            <select value={scope} onChange={(e) => setScope(e.target.value)}>
              {["SUBNATIONAL", "NATIONAL", "REGIONAL", "MULTILATERAL", "INTERNATIONAL", "OTHER"].map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}
            </select>
          </label>
          <label className="form-field">Country code (optional, ISO 3166-1 alpha-2)
            <input maxLength={2} pattern="[A-Za-z]{2}" value={countryCode} onChange={(e) => setCountryCode(e.target.value.toUpperCase())} placeholder="NG" />
          </label>
          <label className="form-field">Official website (optional)
            <input type="url" maxLength={2048} value={officialWebsite} onChange={(e) => setOfficialWebsite(e.target.value)} placeholder="https://" />
          </label>
          <label className="form-field">Publicly documented mandate (optional)
            <textarea maxLength={4000} value={mandateSummary} onChange={(e) => setMandateSummary(e.target.value)} />
          </label>
          <div><button className="button button-primary" type="submit" disabled={busy}>{busy ? "Saving…" : "Add prospective institution"}</button></div>
        </form>
        {notice ? <p role="status" aria-live="polite">{notice}</p> : null}
      </section>

      <section className="page-stack" aria-labelledby="institution-list-title">
        <div className="section-header">
          <div><h2 id="institution-list-title">Institution directory</h2><p>{institutions.length} most recently updated records (maximum 200).</p></div>
          <button className="button button-secondary" type="button" onClick={() => reload().catch((error) => setNotice(error.message))}>Refresh</button>
        </div>
        {institutions.length ? (
          <div className="glass-panel admin-table-wrap">
            <table className="admin-table">
              <caption className="sr-only">Prospective export and trade institutions</caption>
              <thead><tr><th scope="col">Institution</th><th scope="col">Jurisdiction</th><th scope="col">Category / scope</th><th scope="col">Relationship</th><th scope="col">Evidence status</th></tr></thead>
              <tbody>{institutions.map((item) => (
                <tr key={item.id}>
                  <td><strong>{item.officialName}</strong>{item.acronym ? <><br /><span>{item.acronym}</span></> : null}{item.officialWebsite ? <><br /><a href={item.officialWebsite} target="_blank" rel="noreferrer">Official website</a></> : null}</td>
                  <td>{item.countryCode || "Multi-jurisdiction / not specified"}</td>
                  <td>{item.category.replaceAll("_", " ")}<br />{item.scope.replaceAll("_", " ")}</td>
                  <td>{item.relationshipStatus.replaceAll("_", " ")}</td>
                  <td>{item.verificationStatus.replaceAll("_", " ")}<br />{item.evidence.length} recent evidence item(s)</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <div className="glass-panel"><p>No institutional records yet. Add a prospect above after reviewing its official sources.</p></div>}
      </section>
    </div>
  );
}
