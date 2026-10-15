import { useId, type ReactNode } from "react";
import { OperationalFlowIllustration } from "@/components/illustrations/OperationalFlowIllustration";

type ModuleBannerProps = {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
  visual?: "flow" | "evidence" | "jurisdiction" | "compliance" | "none";
};

export function ModuleBanner({ eyebrow, title, description, action, visual = "none" }: ModuleBannerProps) {
  const titleId = useId();

  return (
    <section className="module-banner" aria-labelledby={titleId}>
      <div className="module-banner-copy">
        <p className="module-banner-eyebrow">{eyebrow}</p>
        <h2 id={titleId} className="module-banner-title">{title}</h2>
        <p className="module-banner-description">{description}</p>
        {action ? <div className="module-banner-actions">{action}</div> : null}
      </div>
      {visual !== "none" ? (
        <div className="module-banner-visual">
          {visual === "flow" ? <OperationalFlowIllustration /> : null}
          {visual === "evidence" ? (
            <div className="module-banner-art operational-illustration" aria-hidden="true">
              <div className="operational-illustration-caption"><span className="operational-illustration-signal" />Evidence pathway</div>
              <div className="operational-flow-nodes">
                {["Capture", "Classify", "Review", "Use"].map((label, index) => (
                  <div className="operational-flow-node" key={label}>
                    <span className="operational-flow-node-number">{String(index + 1).padStart(2, "0")}</span>
                    <span className="operational-flow-node-copy"><strong>{label}</strong><small>{["Original record", "Source quality", "Human oversight", "Controlled action"][index]}</small></span>
                  </div>
                ))}
              </div>
              <div className="operational-illustration-foot"><span>SOURCE-AWARE</span><span>REVIEWABLE</span><span>TRACEABLE</span></div>
            </div>
          ) : null}
          {visual === "jurisdiction" ? (
            <div className="module-banner-art jurisdiction-illustration" role="img" aria-label="Illustrative jurisdiction comparison framework">
              <div className="jurisdiction-illustration-header"><span>Comparison framework</span><span>Illustrative</span></div>
              <div className="jurisdiction-illustration-columns">
                <div className="jurisdiction-illustration-column jurisdiction-illustration-column-primary"><strong>Option A</strong><small>Candidate</small></div>
                <div className="jurisdiction-illustration-column"><strong>Option B</strong><small>Candidate</small></div>
              </div>
              {["Evidence quality", "Operating fit", "Open questions"].map((label) => (
                <div className="jurisdiction-illustration-row" key={label}><span>{label}</span><div><b>Review</b><b>Assess</b></div></div>
              ))}
              <p className="jurisdiction-illustration-note">Illustrative only. No jurisdiction is recommended.</p>
            </div>
          ) : null}
          {visual === "compliance" ? (
            <div className="module-banner-art compliance-pulse" role="img" aria-label="Illustration of obligations, evidence review and deadline monitoring">
              {[
                { n: "01", title: "Obligations", detail: "Defined scope", variant: "gold" },
                { n: "02", title: "Evidence", detail: "Human review", variant: "cyan" },
                { n: "03", title: "Deadlines", detail: "Tracked dates", variant: "violet" },
              ].map((item) => (
                <div className="compliance-pulse-row" key={item.n}>
                  <span className={`compliance-pulse-number compliance-pulse-${item.variant}`}>{item.n}</span>
                  <span className="compliance-pulse-copy"><strong>{item.title}</strong><small>{item.detail}</small></span>
                  <span className="compliance-pulse-track"><span className={`compliance-pulse-fill compliance-pulse-fill-${item.variant}`} /></span>
                </div>
              ))}
              <p className="compliance-pulse-note">Illustrative workflow. Not a legal determination.</p>
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="module-banner-decoration" aria-hidden="true" />
    </section>
  );
}
