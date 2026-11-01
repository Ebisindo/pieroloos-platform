# PieroloOS Design System

## Visual direction

Use midnight navy as the primary canvas, metallic gold for brand identity and primary actions, refined violet for intelligence surfaces, and cyan for technical signals. Cosmic effects should be restrained and never obscure content.

## Brand integrity

Use `components/brand/BrandLogo.tsx` for logo placements. The official logo asset is maintained at `public/brand/pierolocorp-logo.jpg`; do not redraw, crop into a new mark, recolour, or reference the source image directly from pages.

## Foundations and layout

- Reuse the existing semantic tokens in `app/globals.css`.
- Shared UI primitives live in `components/ui/primitives.tsx`: `GlassPanel`, `StatusBadge`, `MetricCard`, `PageHeader`, `SectionHeader`, and `EmptyState`.
- Keep the existing application shell, navigation, spacing, breakpoints and focus treatment. Extend existing systems rather than introducing parallel tokens.
- Minimum supported layout width is 320 CSS pixels.
- The responsive breakpoint system is already established at 1000px, 760px, and 480px. Add narrower refinements only where needed.

## Accessibility and interaction

- Information hierarchy precedes decoration.
- Glow is a signal, not a background effect.
- Glass surfaces separate work areas without hiding structure.
- Gold is reserved for identity and important actions.
- Every status must remain understandable without colour alone.
- Motion must respect `prefers-reduced-motion`.
- Mobile interaction must not depend on hover.
- Preserve visible `:focus-visible` focus rings. Avoid suppressing outlines unless a visible replacement exists.
- Ensure tap targets, text wrapping, contrast, semantics and screen-reader labels remain usable at small widths.
- Known accessibility gaps include small text and some muted text combinations that may fall below WCAG AA contrast; these still require a dedicated audit.

## Responsive banner and illustration system

The reusable banner is `components/ui/ModuleBanner.tsx`. It supports a heading/description, optional action and one of the local visual patterns: operational flow, evidence pathway, illustrative jurisdiction comparison, compliance pulse, or no visual. It generates a unique heading id with React `useId()`.

Local illustration components are:
- `components/illustrations/OperationalFlowIllustration.tsx` — evidence-to-execution pathway.
- `components/illustrations/EvidenceNetworkIllustration.tsx` — source, evidence, review and decision relationship.
- `components/illustrations/JurisdictionCompareIllustration.tsx` — illustrative criteria comparison.
- `components/illustrations/CompliancePulseIllustration.tsx` — obligation/evidence/deadline relationship.

### Integrated application routes

The banner is integrated into:
- Command Center: `/command-center`.
- Client Intake: `/clients/new`.
- Client workspace / client-portal access: `/clients`.
- Jurisdiction Lens: `/jurisdictions`.
- Formation: `/formation`.
- Compliance: `/compliance`.
- Reports: `/reports`.
- Engagements: `/engagements`.

The banner is presentation-only. Existing workspace context, repository queries, permission checks, workflow components, professional-review gates and data writes remain authoritative. Illustrations do not feed data into the workflows, and diagram labels must never be presented as live workspace metrics or recommendations.

The product navigation’s “Business Profile” item currently points to `/clients` and is labelled a foundation in `lib/navigation.ts`. There is no separate `app/business-profile/page.tsx` route in this branch. Do not create a new profile editor or change routing until its intended create/edit workflow, permissions and data ownership are identified. The `/clients` screen is presently for workspace client-portal access/interactions, not a dedicated business-profile editor.

Reports and Engagements currently display their existing empty states. Adding banner illustrations does not imply that report generation or a full engagement CRUD workflow is implemented. Keep this distinction clear.

A preview route is available at `/command-center/visual-preview`. Its sample content is illustrative, not live telemetry.

### Responsive behaviour and verification

Small screens collapse illustration grids and stack actions, while the existing reduced-motion support remains in force. Review at 320, 360, 390, 430, 480, 560, 760, 768, 1000, 1024, 1280, 1440 and 1920 CSS pixels.

Check horizontal overflow, text/button wrapping, touch use, keyboard focus, contrast, accessible headings and labels, reduced motion, plus empty/loading/error states. CI and source-level assertions do not substitute for visual browser screenshots, a dedicated accessibility audit or physical-device testing. Do not state that those reviews are complete until performed.
