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

The suite covers public routes `/` and `/partners`, plus signed-out access gates for `/business-profile`, `/reports`, `/engagements` and `/command-center`. The feature branch now provisions a disposable PostgreSQL CI database and a reserved `@integration.invalid` test identity; the test-only credentials provider is guarded by `CI=true`, `DATABASE_ENV=ci`, a loopback-only URL and database, and a per-run random secret. This path is not enabled in preview or production. Authenticated journeys are implemented and the CI run is being validated; do not mark them verified until the latest run is green.

## Automated checks

- Unexpected horizontal overflow at each viewport.
- Accessible-name and landmark checks through axe on representative public routes.
- Screenshot artifacts for selected widths; authenticated workspace views are also being captured at 320, 390, 768 and 1280 CSS pixels.
- Main landmark, document language, and navigable links.
- Signed-out routes must render an access state rather than disclose workspace records.
- Primary navigation link visibility is smoke-tested on public routes. The workspace shell skip link has a keyboard check for visibility, activation and focus reaching `#main-content`. Manual verification is still required on authenticated sessions and physical devices.
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
- [ ] On authenticated workspace routes, verify the skip link becomes visible on keyboard focus, activates correctly, and places users at `#main-content`.
- [ ] Screen reader on at least one supported desktop/browser setup and one mobile setup.
- [ ] Browser zoom at 200% and 400% reflow, plus increased text-only sizing where supported.
- [ ] Forced-colors/high-contrast and reduced-motion preferences.
- [ ] Form labels, required state, error summaries, confirmation announcements, menu focus, and skip-link behavior.
- [ ] Report export opened, read and printed on desktop and mobile.
- [ ] Record date, device/OS, browser, assistive technology, tester, findings and evidence.

## Current automated evidence

Latest verified automated run: [CI #38853714889](https://github.com/Ebisindo/pieroloos-platform/actions/runs/38853714889), code head `5a76aca2e40a95564e1312aefff93505a8f9ec2e`, completed successfully on 16 October 2026. Both `quality` and `e2e` passed:
- PostgreSQL validation/migration and database-integrity tests.
- ESLint, TypeScript, unit tests and production builds.
- Authenticated journeys for Business Profile save/reload, Reports generation/preview/HTML export, Engagement creation/edit/lifecycle/activity and foreign-workspace access denial.
- 40 Playwright tests passed; responsive overflow and keyboard skip-link checks passed.

The `playwright-results` artifact (ID `12026207411`, expires 30 October 2026) was downloaded and inspected. It contains public screenshots, 20+ authenticated responsive screenshots for Business Profile, Reports (including the generated report), and Engagements at 320, 390, 768 and 1280 CSS pixels, and the Playwright HTML report. Reviewed 320px views show the toolbar no longer displays the stray “Select language” label and content cards/forms stack vertically without observed horizontal overflow. These captures are browser emulation, not physical-device verification.

The Playwright report's six attached authenticated axe result payloads were inspected for `/business-profile`, `/business-profile/[id]`, `/reports`, the generated report view, `/engagements`, and `/engagements/[id]`: each has an empty `violations` array for the configured WCAG 2.1 A/AA rules. The public-route axe scans also passed for English, French, Portuguese and Spanish. This result is bounded to the tested DOM states and automated rules; it is not proof of complete WCAG conformance.

The generated HTML report assertion passed: downloaded HTML contains the updated profile objective and professional-review caveat and does not contain a raw `<script>` tag. This verifies the test fixture's export contents and escaped script-like markup guard; it does **not** replace opening, reading and printing the file on real devices.

Locale catalogs en/fr/es/pt were checked: 1,217 unique keys per catalog, with no missing, extra or duplicate keys.

## Release statement

Until the manual checklist below is completed on actual devices and evidence is recorded, status is **automated checks passed / physical-device verification pending**; assistive-technology verification is also pending. Do not describe the application as WCAG-certified.
