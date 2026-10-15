const criteria = [
  { label: "Evidence quality", values: ["Strong", "Review"] },
  { label: "Operating fit", values: ["Suitable", "Assess"] },
  { label: "Open questions", values: ["2 items", "4 items"] },
];

export function JurisdictionCompareIllustration() {
  return (
    <div className="jurisdiction-illustration" role="img" aria-label="Illustrative comparison of two jurisdictions across evidence quality, operating fit and open questions">
      <div className="jurisdiction-illustration-header">
        <span>Comparison framework</span>
        <span>Illustrative</span>
      </div>
      <div className="jurisdiction-illustration-columns">
        <div className="jurisdiction-illustration-column jurisdiction-illustration-column-primary">
          <strong>Option A</strong><small>Candidate</small>
        </div>
        <div className="jurisdiction-illustration-column">
          <strong>Option B</strong><small>Candidate</small>
        </div>
      </div>
      {criteria.map((criterion) => (
        <div className="jurisdiction-illustration-row" key={criterion.label}>
          <span>{criterion.label}</span>
          <div><b>{criterion.values[0]}</b><b>{criterion.values[1]}</b></div>
        </div>
      ))}
      <p className="jurisdiction-illustration-note">Internal indicators support review; they are not legal or tax conclusions.</p>
    </div>
  );
}
