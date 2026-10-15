import type { ReactNode } from "react";
import { OperationalFlowIllustration } from "@/components/illustrations/OperationalFlowIllustration";

type ModuleBannerProps = {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
  visual?: "flow" | "none";
};

export function ModuleBanner({
  eyebrow,
  title,
  description,
  action,
  visual = "none",
}: ModuleBannerProps) {
  return (
    <section className="module-banner" aria-labelledby="module-banner-title">
      <div className="module-banner-copy">
        <p className="module-banner-eyebrow">{eyebrow}</p>
        <h2 id="module-banner-title" className="module-banner-title">{title}</h2>
        <p className="module-banner-description">{description}</p>
        {action ? <div className="module-banner-actions">{action}</div> : null}
      </div>
      {visual === "flow" ? (
        <div className="module-banner-visual">
          <OperationalFlowIllustration />
        </div>
      ) : null}
      <div className="module-banner-decoration" aria-hidden="true" />
    </section>
  );
}
