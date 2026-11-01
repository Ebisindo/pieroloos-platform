type FlowNode = {
  number: string;
  title: string;
  detail: string;
};

const nodes: FlowNode[] = [
  { number: "01", title: "Evidence", detail: "Sources and records" },
  { number: "02", title: "Intelligence", detail: "Gaps and confidence" },
  { number: "03", title: "Decision", detail: "Human review" },
  { number: "04", title: "Execution", detail: "Tracked next steps" },
];

export function OperationalFlowIllustration() {
  return (
    <div className="operational-illustration" aria-hidden="true">
      <div className="operational-illustration-orbit operational-illustration-orbit-a" />
      <div className="operational-illustration-orbit operational-illustration-orbit-b" />
      <div className="operational-illustration-caption">
        <span className="operational-illustration-signal" />
        Operational intelligence
      </div>
      <div className="operational-flow-nodes">
        {nodes.map((node, index) => (
          <div className="operational-flow-node" key={node.number}>
            <span className="operational-flow-node-number">{node.number}</span>
            <span className="operational-flow-node-copy">
              <strong>{node.title}</strong>
              <small>{node.detail}</small>
            </span>
            {index < nodes.length - 1 ? (
              <span className="operational-flow-connector" />
            ) : null}
          </div>
        ))}
      </div>
      <div className="operational-illustration-foot">
        <span>TRACEABLE</span>
        <span>REVIEWABLE</span>
        <span>CONTROLLED</span>
      </div>
    </div>
  );
}
