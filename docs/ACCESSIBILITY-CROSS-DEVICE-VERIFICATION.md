# Cross-Device Accessibility Verification

## Purpose and limits

This is the repeatable verification plan for the PieroloOS responsive application. Automated browser checks can detect a useful subset of accessibility and layout regressions. They do **not** establish conformance certification, and they do not replace manual keyboard, screen-reader, real mobile device, tablet, zoom, or assistive-technology verification.

## Tools and versions

- Playwright using the version pinned in `package-lock.json`.
- `@axe-core/playwright` using the version pinned in `package-lock.json`.
- Chromium in the existing GitHub Actions E2E job.
- GitHub Actions artifacts for Playwright reports, screenshots and test-results.
- Run locally with `npm run test:e2e`; run lint, typecheck, unit tests and production build for the full change.

## Viewport matrix

The automated smoke matrix targets CSS viewport widths of 320, 360, 390, 430, 480, 560, 760, 768, 1000, 1024, 1280, 1440 and 1920 pixels. A 900 CSS-pixel height is the default automated height; narrow and content-heavy pages should also be checked at 667 and 1024 pixel heights during manual verification.

All widths are tests of Chromium's emulated viewport, **not** evidence of testing a physical device or a specific operating system.

## Route coverage

The suite should cover public routes `/` and `/partners`, and signed-out state / access gates for `/business-profile`, `/reports`, `/engagements` and `/command-center`. Signed-in workflow tests must use an isolated non-production test database and a documented test identity; do not enable authentication bypasses in public preview or production. Until such an identity is wired into CI, internal workspace views are not considered authenticated E2E-verified.

## Automated checks

- No unexpected horizontal overflow at the viewport matrix, allowing intentional horizontal overflow only for elements that are explicitly keyboard accessible and documented.
- Accessible-name and landmark checks through axe on representative public and access-gate routes.
- Capture screenshot artifacts on tested viewports to support review.
- Keyboard focus visibility and skip-link existence.
- Route load / access-gate resilience.
- Reduced-motion media query support via source/behavior assertions where possible.
- Touch targets: controls should generally meet at least 24 by 24 CSS px with spacing, and primary mobile controls should target 44 by 44 CSS px.
- Text should wrap at narrow widths and retain usable content when browser text zoom is increased.
- Test loading, empty, success and failure states in component/API tests where reliable.

## Severity and remediation policy

- **Critical / serious axe findings:** block merge until fixed or explicitly adjudicated with a documented, scoped exception and owner.
- **Moderate / minor findings:** record and triage; fix when practical before release, never suppress merely to obtain a green job.
- **Overflow:** unexpected overflow is a regression. If discovered, attach a screenshot, identify route/viewport and block merge when content or controls become inaccessible.
- Record browser, viewport, route, finding, impact, owner/status and any accepted limitation when a finding is observed. CI output is the evidence record for automated runs; link the run and artifact when available.

## Manual and physical-device checklist — PENDING

The following work is not marked complete by CI emulation. Complete it before claiming formal cross-device accessibility verification:

- [ ] Physical Android phone at 320–430 CSS px equivalent, portrait and landscape.
- [ ] Physical tablet in portrait and landscape.
- [ ] Desktop keyboard-only navigation, with visible focus and logical focus order.
- [ ] Screen reader on at least one supported desktop/browser combination and one mobile combination.
- [ ] Browser zoom at 200% and 400% reflow, plus increased text-only sizing where supported.
- [ ] Forced-colors/high-contrast setting and reduced-motion preference.
- [ ] Form labels, required state, errors, confirmation announcements, menus/dialog focus management and skip-link behavior.
- [ ] Report download opened, read and printed on desktop and mobile.
- [ ] Record date, device/OS, browser, assistive technology, tester, issues and evidence.

## Release statement

Until artifacts from the automated suite and a completed manual checklist are reviewed, the status is **automated checks only / physical-device verification pending**. Do not describe the application as WCAG-certified.
