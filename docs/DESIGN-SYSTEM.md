# PieroloOS Design System

PieroloOS — Business Intelligence & Formation Platform.
Tagline: From Business Idea to Business Infrastructure.

## Brand

- Use `components/brand/BrandLogo.tsx` (`mark` or `lockup`; sizes `sm`–`xl`) for every logo placement. Do not reference the logo file directly.
- Official asset: `public/brand/pierolocorp-logo.jpg` (1536×1536, opaque dark background, so it is always shown in a rounded or circular frame). A transparent SVG lockup is not yet available.

## Semantic tokens (`app/globals.css`)

- Colour: `--color-bg`, `--color-surface`, `--color-surface-strong`, `--color-border`, `--color-border-strong`, `--color-text`, `--color-text-muted`, `--color-text-subtle`, `--color-brand`, `--color-accent`, `--color-info`, `--color-focus`.
- Type: `--font-sans`, `--font-display`. Spacing: `--space-1`–`--space-7`. Radius: `--radius-sm|md|lg|pill`.
- Buttons: `.button` with `.button-primary` (gold, one per view) or `.button-secondary`.
- Focus: global `:focus-visible` ring; form inputs use the same colour. Do not suppress outlines with `outline-none` without a visible replacement.
- Typography: Inter and Space Grotesk via `next/font/google` (`--font-inter`, `--font-space-grotesk`).
- Public pages: `components/public/PublicShell.tsx`; trust notices: `components/evidence/TrustBoundaryNotice.tsx`.
- Known gaps: no SVG or favicon set; small text (8–10px) and some Tailwind `slate-500` text likely below WCAG AA contrast; not yet audited.

## Visual tokens

- Midnight navy: primary environment
- Metallic gold: identity / executive action
- Violet: intelligence
- Cyan: technical/system information
- Green: operational success
- Red: actionable failure

## Principles

1. Information hierarchy before decoration.
2. Glow is a signal, not a background effect.
3. Glass surfaces separate workspaces without hiding structure.
4. Gold is reserved for identity and important actions.
5. Every state must remain understandable without color alone.
6. Motion must respect `prefers-reduced-motion`.
7. Mobile interaction must not depend on hover.

## Component hierarchy

Shell
→ PageHeader
→ SectionHeader
→ GlassPanel
→ MetricCard / StatusBadge / EmptyState
→ Domain-specific components
