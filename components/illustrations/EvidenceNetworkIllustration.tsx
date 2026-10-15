const evidenceNodes = [
  { label: "Source", kind: "source" },
  { label: "Evidence", kind: "evidence" },
  { label: "Review", kind: "review" },
  { label: "Decision", kind: "decision" },
] as const;

export function EvidenceNetworkIllustration() {
  return (
    <div className="evidence-network" role="img" aria-label="Illustration of source material flowing through evidence, review and decision">
      <div className="evidence-network-line" aria-hidden="true" />
      {evidenceNodes.map((node, index) => (
        <div className="evidence-network-node" key={node.kind}>
          <span className={`evidence-network-dot evidence-network-dot-${node.kind}`} aria-hidden="true">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span>{node.label}</span>
        </div>
      ))}
      <p className="evidence-network-note">Source-aware · Reviewable · Traceable</p>
    </div>
  );
}
