import Link from "next/link";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { OperationalFlowIllustration } from "@/components/illustrations/OperationalFlowIllustration";
import { EvidenceNetworkIllustration } from "@/components/illustrations/EvidenceNetworkIllustration";
import { JurisdictionCompareIllustration } from "@/components/illustrations/JurisdictionCompareIllustration";
import { CompliancePulseIllustration } from "@/components/illustrations/CompliancePulseIllustration";
import { GlassPanel, PageHeader } from "@/components/ui/primitives";

export default function CommandCenterVisualPreviewPage() {
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Design system preview"
        title="Operational clarity, across every screen."
        description="A visual preview of the responsive PieroloOS illustration system. Example values and diagrams on this page are illustrative, not live workspace data."
        actions={<Link className="button button-secondary" href="/command-center">Return to Command Center</Link>}
      />

      <section className="module-banner">
        <div className="module-banner-copy">
          <div className="module-banner-eyebrow">Corporate intelligence / visual system</div>
          <h2 className="module-banner-title">From fragmented work to controlled execution.</h2>
          <p className="module-banner-description">
            Connect business context, evidence, human review and operational actions in a workspace
            designed for mobile, tablet, laptop and desktop use.
          </p>
          <div className="module-banner-actions">
            <Link href="/clients/new" className="button button-primary">Start client intake</Link>
            <Link href="/jurisdictions" className="button button-secondary">Explore Jurisdiction Lens</Link>
          </div>
        </div>
        <div className="module-banner-visual">
          <OperationalFlowIllustration />
        </div>
        <div className="module-banner-decoration" aria-hidden="true" />
      </section>

      <div className="dashboard-grid">
        <div className="stack">
          <GlassPanel>
            <div className="section-header">
              <div><h2>Evidence intelligence</h2><p>Source material becomes reviewable evidence.</p></div>
            </div>
            <div className="p-4"><EvidenceNetworkIllustration /></div>
          </GlassPanel>
          <GlassPanel>
            <div className="section-header">
              <div><h2>Jurisdiction Lens</h2><p>Structured comparison with visible assumptions.</p></div>
            </div>
            <div className="p-4"><JurisdictionCompareIllustration /></div>
          </GlassPanel>
        </div>
        <div className="stack">
          <GlassPanel>
            <div className="section-header">
              <div><h2>Compliance operations</h2><p>Obligations, evidence and deadlines remain connected.</p></div>
            </div>
            <div className="p-4"><CompliancePulseIllustration /></div>
          </GlassPanel>
          <GlassPanel className="visual-preview-brand-panel">
            <BrandLogo variant="lockup" size="lg" />
            <h2>Designed for professional work</h2>
            <p>
              Quiet cosmic depth, clear status signals, accessible controls and responsive layouts.
              Illustrations explain relationships; authenticated application data remains the source
              of operational truth.
            </p>
          </GlassPanel>
        </div>
      </div>
    </div>
  );
}
