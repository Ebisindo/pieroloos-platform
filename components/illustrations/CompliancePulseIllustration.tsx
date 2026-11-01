const stages = [
  { number: "01", label: "Obligations", value: "Tracked", variant: "gold" },
  { number: "02", label: "Evidence", value: "Reviewed", variant: "cyan" },
  { number: "03", label: "Deadlines", value: "Monitored", variant: "violet" },
] as const;

export function CompliancePulseIllustration() {
  return (
    <div className="compliance-pulse" role="img" aria-label="Illustration of compliance obligations, evidence review and deadline monitoring">
      {stages.map((stage) => (
        <div className="compliance-pulse-row" key={stage.number}>
          <span className={`compliance-pulse-number compliance-pulse-${stage.variant}`}>{stage.number}</span>
          <span className="compliance-pulse-copy"><strong>{stage.label}</strong><small>{stage.value}</small></span>
          <span className="compliance-pulse-track"><span className={`compliance-pulse-fill compliance-pulse-fill-${stage.variant}`} /></span>
        </div>
      ))}
      <p className="compliance-pulse-note">Workflow status is not a legal determination.</p>
    </div>
  );
}
