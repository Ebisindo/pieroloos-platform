# PieroloOS — Responsive Visual UI/UX Implementation Brief

Related issue: #16 — UI/UX Enhancement: Responsive Banner Illustrations and Cross-Device Experience.

## Existing foundation to preserve

The repository already has a semantic design-token system in `app/globals.css`, shared primitives in `components/ui/primitives.tsx`, the authoritative logo wrapper at `components/brand/BrandLogo.tsx`, a responsive application shell, CSS breakpoints at 1000px, 760px and 480px, and a reduced-motion media query. Extend these assets rather than creating a competing visual system.

The authoritative supplied logo is `public/brand/pierolocorp-logo.jpg`. Render it through `BrandLogo`; do not redraw, morph, or reference the file directly from new UI code.

## Visual direction

- Executive software aesthetic: midnight navy, metallic gold for primary identity/action, violet for intelligence, cyan for technical state.
- Use quiet orbital geometry, subtle abstract flows, connected nodes and evidence pathways as lightweight CSS/SVG illustration.
- Keep banners informative: title, short context, optional operational state, primary action and a restrained illustration.
- Don't use decorative effects as a substitute for product information.
- Avoid external/remote assets, autoplay video, heavy particle systems, crypto/gaming visual language and excessive glow.

## Suggested reusable components

Implement the smallest coherent component set that fits established repository patterns:

- `components/illustrations/OperationalFlowIllustration.tsx`: abstract connected workflow nodes.
- `components/illustrations/EvidenceNetworkIllustration.tsx`: evidence/source/review relationship.
- `components/illustrations/JurisdictionCompareIllustration.tsx`: two or three comparable jurisdiction cards.
- `components/illustrations/CompliancePulseIllustration.tsx`: deadline, evidence and review status.
- `components/ui/ModuleBanner.tsx`: responsive page banner using design tokens and semantic HTML.

Illustrations should be decorative when they add no information (`aria-hidden="true"`) and should not use colour as the only way to convey state. A banner must not duplicate or replace the page's main `h1`.

## Placement plan

1. Command Center: operational overview and connected-workflow illustration.
2. Client Intake / Business Profile: a concise onboarding-to-profile visual.
3. Jurisdiction Lens: structured comparison visual.
4. Formation: ordered stages/dependencies.
5. Compliance: deadlines, evidence and review gates.
6. Reports: evidence-backed report pathway.
7. Engagements: client/service/activity timeline.

Keep each banner focused on the route's purpose. Don't force all seven screens into identical copy or layout.

## Responsive acceptance matrix

Review at these viewport widths: 320, 360, 390, 430, 768, 1024, 1280, 1440 and 1920 CSS pixels.

At every width verify:
- no page-level horizontal overflow;
- heading and actions wrap without overlap;
- illustrations shrink, crop safely or move below the text;
- no text is embedded inside an image;
- controls have comfortable touch targets and don't depend on hover;
- sidebar/off-canvas navigation stays usable by keyboard and touch;
- focus remains visible;
- reduced-motion mode disables non-essential animation;
- loading, empty, error, partial and unavailable states remain understandable.

## Validation

Use existing project commands:

```bash
npm run lint
npm run typecheck
npm test
npm run db:validate
npm run db:inventory
npm run build
```

The visual change should not require a database migration unless a validated product requirement explicitly needs a schema change.

Browser-level viewport, accessibility and screenshot checks must be reported as passed only after they have actually been executed. The repository's current readiness record notes that browser/responsive review has previously been untested; close that gap rather than inferring success from build output.

## Scope and safety

This issue is presentation-focused. Preserve routes, authentication, workspace permissions, data access, compliance logic and audit behaviour. Do not introduce fabricated metrics or imply that a design illustration is live system telemetry. Any operational status shown in a banner must come from the authenticated server-side data source or be clearly labelled as illustrative.
