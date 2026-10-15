# Cross-Device Accessibility Verification

## Purpose and limits

This is the repeatable verification plan for the PieroloOS responsive application. Automated browser checks detect a subset of accessibility and layout regressions; they do **not** establish WCAG certification, and do not replace manual keyboard, screen-reader, real phone/tablet, zoom, or assistive-technology verification.

## Tools and versions

- Playwright and `@axe-core/playwright`, pinned through `package-lock.json`.
- Chromium in the existing GitHub Actions E2E job.
- GitHub Actions artifacts for Playwright test results, reports and screenshots.
- Run locally with `npm run test:e2e`; run lint, typecheck, unit tests, database integrity tests and production build for the full change.

## Viewport matrix

The automated smoke matrix targets CSS viewport widths of 320, 360, 390, 430, 480, 560, 760, 768, 1000, 1024, 1280, 1440 and 1920 pixels. The default automated height is 900 pixels. Content-heavy pages should also be checked at 667 and 1024 pixel heights during manual verification.

These widths are browser-emulated CSS viewports, **not** evidence that physical devices or a particular OS have been tested.

## Route coverage

The suite covers public routes `/` and `/partners`, plus signed-out access gates for `/business-profile`, `/reports`, `/engagements` and `/command-center`. Signed-in workflow tests need an isolated non-production database and a documented test identity. Do not enable authentication bypasses in public preview or production. Until that identity is wired into CI, internal workspace views are not considered authenticated E2E-verified.

## Automated checks

- Unexpected horizontal overflow at each viewport.
- Accessible-name and landmark checks through axe on representative public routes.
- Screenshot artifacts for selected widths.
- Main landmark, document language, and navigable links.
- Signed-out routes must render an access state rather than disclose workspace records.
- Primary navigation link visibility is smoke-tested on public routes. The automated suite does not yet exercise the authenticated workspace skip link; verify focus reveal, activation and target focus manually and add a dedicated automated check when stable.
- Reduced-motion support, touch targets, zoom/text wrapping, and loading/empty/error states also require component assertions or manual review; do not imply that axe alone verifies these.

## Severity and remediation policy

- **Critical / serious axe findings:** block merge until fixed or explicitly adjudicated with a documented scoped exception and owner.
- **Moderate / minor findings:** record and triage; do not suppress merely to obtain a green job.
- **Overflow:** unexpected overflow is a regression. Attach the route, viewport and screenshot; block merge when content or controls become inaccessible.
- Record browser, viewport, route, finding, impact, owner/status and accepted limitations when observed. Link to the CI run and artifact for automated findings.

## Manual and physical-device checklist — PENDING

The following work is not marked complete by CI emulation. Complete it before claiming formal cross-device accessibility verification:

- [ ] Physical Android phone, portrait and landscape.
- [ ] Physical tablet, portrait and landscape.
- [ ] Desktop keyboard-only navigation, visible focus and logical focus order.
- [ ] In authenticated workspace routes, tab to the skip link, verify it becomes visible, activate it, and confirm focus/reading position reaches `#main-content`.
- [ ] Screen reader on at least one supported desktop/browser setup and one mobile setup.
- [ ] Browser zoom at 200% and 400% reflow, plus increased text-only sizing where supported.
- [ ] Forced-colors/high-contrast and reduced-motion preferences.
- [ ] Form labels, required state, error summaries, confirmation announcements, menu focus, and skip-link behavior.
- [ ] Report export opened, read and printed on desktop and mobile.
- [ ] Record date, device/OS, browser, assistive technology, tester, findings and evidence.

## Current automated evidence

Latest recorded run for PR #19: [CI run #38759698961](https://github.com/Ebisindo/pieroloos-platform/actions/runs/38759698961), head `75fbc72fe53daa3ffc1c3e41b0ec784ae0138b42`. Quality and E2E jobs passed. The Playwright artifact contains the public-route responsive screenshots and HTML report. After the test assertion clarification committed on the feature branch, rerun CI before merge; the earlier run does not validate that subsequent commit.

## Release statement

Until automated artifacts are reviewed and the manual checklist is completed, status is **automated checks only / physical-device verification pending**. Do not describe the application as WCAG-certified.
