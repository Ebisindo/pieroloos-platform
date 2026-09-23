# PieroloOS Design System

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
