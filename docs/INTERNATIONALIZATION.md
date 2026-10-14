# Internationalization

## Current scope and language status

English remains the default. The locale selector is available on public pages and in the authenticated workspace, keeps the current unprefixed URL and query string, and stores only the validated locale code in a one-year, same-site cookie. Switching locale does not reset form state, change workflow values, or alter authentication and authorization.

The catalogs are wired to the homepage and partnership page, public navigation and footer, the partnership inquiry form, sign-in, the workspace shell, client intake, client portal, dashboard and notifications, jurisdiction comparisons and detail view, formation workflow, compliance control center and obligations, report placeholder, and workspace settings. The business profile is captured through the existing intake and jurisdiction comparison flows; no standalone business-profile route exists in this checkout.

This is not complete localization of every application surface. Market expansion, cross-border preparation, engagement screens and the shared access/workspace/boot components are now translated; some less frequently used support components (evidence panels, audit timeline, trust-boundary notices, action status badges) and domain-generated text still contain English. Dynamic names, user-entered notes and statements, notification subject/body text already stored in the database, and human-readable error messages returned by APIs are deliberately not rewritten by the UI translator. These omissions do not change API contracts or stored records.

English remains the default and source language. French, Portuguese and Spanish are shown as **preview** options, not fully supported languages. A preview notice explains that other product content may remain in English and translations have not been professionally reviewed.

| Locale | Registry | Catalog | Current UI coverage | Automated catalog checks | Human translation review |
| --- | --- | --- | --- | --- | --- |
| English (`en`) | Default | Complete source catalog | Public and listed application surfaces | Passed | Source language |
| French (`fr`) | Proposed / preview | Prepared | Public and listed application surfaces; gaps remain as noted above | Passed | Not completed |
| Portuguese (`pt`) | Proposed / preview | Prepared | Public and listed application surfaces; gaps remain as noted above | Passed | Not completed |
| Spanish (`es`) | Proposed / preview | Prepared | Public and listed application surfaces; gaps remain as noted above | Passed | Not completed |

There are now public FAQ and Terms routes and a Policies & Legal directory with draft policy routes. The FAQ/Terms/legal document bodies are source-authored in English; French, Portuguese and Spanish catalogues provide the page-level navigation, metadata and draft-status notices, and the global preview notice remains visible. These languages are not professionally reviewed legal translations. The Terms and policy documents remain non-indexable and marked as drafts until the necessary approvals are documented. Reports are currently an initialized placeholder rather than a generator. Server API response contracts and email templates are not translated by this frontend work.

## Architecture

- `lib/i18n/config.ts` defines English as the default, the locale registry, native names, HTML language tags, direction metadata and locale-cookie settings. `isLocale` validates untrusted locale strings; `getLocale` falls back to English.
- `lib/i18n/messages/en.ts`, `fr.ts`, `pt.ts` and `es.ts` are structured flat catalogs using stable dotted keys such as `navigation.signIn`, `home.hero.title` and `form.validation.required`.
- `lib/i18n/messages.ts` derives `MessageKey` from the English catalog, requires the other catalogs to implement the same keys, exposes `findMissingMessageKeys`, and provides `createTranslator` with interpolation and English fallback. Missing translations warn in development.
- `components/i18n/LocaleProvider.tsx` exposes the active locale and typed translator throughout the application. The server reads the validated preference cookie at the root layout, renders the matching document language/direction, and the client persists locale changes without changing authentication or business data.
- `components/i18n/LanguageSelector.tsx` offers native-language names, marks proposed locales as previews, retains the current URL (including query and hash), updates public-page title and description, and refreshes the active App Router segment so server-rendered content uses the new locale. The refresh does not perform a full document navigation and preserves client component state.
- `lib/i18n/request.ts` reads the locale cookie on the server for public rendering and metadata. Invalid cookie values safely resolve to English.
- Public page canonicals and the sitemap remain on the established, unprefixed URLs. There are no `hreflang` alternates because these cookie-selected variants do not have distinct locale URLs; search crawlers receive the default English version unless they carry a locale cookie.
- `formatNumber`, `formatDate` and `formatCurrency` use `Intl` with the selected locale. Formatting does not change stored amounts or currency identifiers.

Example:

```ts
import { createTranslator } from "@/lib/i18n/messages";

const t = createTranslator("fr");
t("form.messageHint", { count: 12, max: 4000 });
```

In a public client component, use the locale context:

```tsx
const { t } = useLocale();
return <h1>{t("home.hero.title")}</h1>;
```

## Adding messages and locales

1. Add the stable namespaced key and its English source string to `lib/i18n/messages/en.ts`.
2. Add the corresponding meaning to every catalog in `lib/i18n/messages/`. Catalog typing makes missing keys a compile-time error.
3. Preserve interpolation placeholders exactly (for example `{count}` and `{max}`); the catalog test checks that placeholders match.
4. Add any new locale to `lib/i18n/config.ts` with `status: "proposed"` until the full interface is translated, automated checks pass, and qualified human review approves the copy.
5. Run `npm test -- tests/i18n.test.ts`, `npm run typecheck`, and `npm run lint`.

`findMissingMessageKeys(catalog)` lists absent English source keys in a partial catalog. At runtime, `createTranslator` uses the English message when the selected catalog lacks a key and emits a development warning. Do not treat fallback as proof of translation completeness.

## Review requirements

Maintain consistent terminology for jurisdiction, formation roadmap, evidence, obligation, professional review and cross-border preparation. Preserve meaning, provenance limitations, uncertainty, qualifications, warnings, privacy statements and disclaimers. Never translate machine-readable identifiers, API values, stored workflow/user data, protected product names or official legal entity names. API-originated error messages are localized only where mapped in `lib/i18n/api-errors.ts`; others remain in their source language.

Legal-, tax-, accounting-, investment- and jurisdiction-sensitive localized content requires qualified native-language and subject-matter review before publication as authoritative. Translation must not convert observations into legal conclusions or alter business rules. Funding figures remain in Nigerian naira and are not currency-converted by locale formatting. No translation service or external API is part of this architecture.

## Remaining decisions and deployment

No additional i18n deployment configuration or migration is required. The preference uses the `pieroloos-locale` cookie (`Path=/`, `SameSite=Lax`, one-year expiry, `Secure` on HTTPS) and does not store user identity or workflow data. Do not infer that locale changes jurisdiction, regulatory obligations, payment availability or the business's legal location.

Before promoting a proposed locale from preview, translate remaining application surfaces and supporting content, obtain qualified native-speaker and relevant subject-matter review of legal-, tax-, investment- and jurisdiction-sensitive wording, review long-text layouts, and verify the resulting catalog and flows. Consider locale-prefixed URLs and `hreflang` only as a separate SEO/routing decision; do not change callback URLs or route contracts as part of this stage.

## Quality audit status

The four catalogs have matching key sets and interpolation placeholders. Missing catalog entries fall back to English and emit a development warning. The Spanish homepage secondary action is localized as “Explorar PieroloOS”.

Locale variants share the existing cookie-selected, unprefixed routes and canonical URLs; there are no conflicting locale URLs or `hreflang` alternates. The language preference is reflected in the document `lang` attribute, and all currently configured locales use left-to-right text. Automated tests do not provide visual, keyboard, screen-reader, or device-size certification. Some support components, domain-generated text (market-readiness check titles, summaries, next steps and boundary statements; trust-boundary constants) and API-originated error text still require localization or deliberate source-language handling. Proposed locales remain previews until both coverage and qualified human review are complete.

## Multilingual completion audit (feature/i18n-quality-audit)

Newly translated (keys `access.*`, `boot.*`, `workspace.*`, `engagements.*`, `expansion.*`, `marketEntry.*`, `crossBorder.*`, `controlPlane.*`): `/expansion`, `/cross-border`, `/engagements`, `/engagements/[id]`, `WorkspaceAccessState`, `MarketEntryWorkflow`, `CrossBorderDossierWorkflow`, `ActivityTimeline`, `StatusBadge` (engagement), `BootLayer`, `WorkspaceSelector`, `EscalationBanner` and the AppShell user avatar label. Enum values sent to or stored by the API are unchanged; only displayed labels are mapped. Dates use the active locale.

## Full-support readiness pass

Additionally localized (keys `trust.*`, `signals.*`, `intake.classification.*`, `apiError.*`, `marketEntry.readinessText.*`):

- `TrustBoundaryNotice` (now a server component using the request locale): heading, accessible label, the platform-guidance disclaimer and the evidence-gap labels. The English catalog entries are asserted equal to the constants in `lib/domain/trust-boundary.ts`, which remain the source.
- Market-readiness check titles, summaries, next steps and the boundary statement. `lib/i18n/market-readiness.ts` selects text from the stable `check.key`, status codes and stored counts; stored English JSON and the API contract are unchanged, and unknown keys or custom text fall back to the stored string. Tests assert the English locale reproduces the stored text exactly.
- API error messages: `lib/i18n/api-errors.ts` maps about 30 frequently returned English messages to catalog keys on the client (`localizeApiError`). Response bodies and status codes are unchanged. Unmapped messages (the long tail of roughly 180 route-specific strings) are shown as returned in English; extend the map when adding or changing messages.
- `AuditTimeline` (locale-aware dates), `IntakeClassificationLegend`, `ActionStatusBadge` and `EvidenceSignalList`. These are not currently imported by any route but are translated so they are safe to adopt.

Remaining gaps (superseded by the remaining-audit section below): `components/ui/primitives.tsx` contains layout primitives and no reviewed copy; server-side Zod `issues` and the long tail of API errors remain English; user-entered and stored data are intentionally not translated.

## Promotion checklist (proposed to supported)

A locale may be promoted in `lib/i18n/config.ts` only after every item is recorded in the pull request, with reviewer names and dates:

1. Catalog complete (`npm test -- tests/i18n.test.ts tests/i18n-screens.test.ts tests/i18n-domain-text.test.ts`).
2. Qualified native-language review of the whole catalog against the glossary (jurisdiction, formation roadmap, evidence, obligation, professional review, cross-border preparation).
3. Subject-matter (legal/tax/compliance) review of the legally sensitive keys: `trust.*`, `marketEntry.readinessText.boundary`, `crossBorder.*` boundary text, `expansion.*` disclaimers, privacy and terms content, and `apiError.*` permission messages.
4. Browser verification at mobile, tablet and desktop widths with long strings, keyboard navigation, focus visibility and screen reader labels.
5. Decision on locale-prefixed URLs and `hreflang` if search indexing of the locale is wanted.

Until then fr, pt and es remain `proposed` and are labelled preview in the language selector.

## Remaining audit pass (feature/i18n-remaining-audit)

### Route matrix

All 17 `page.tsx` routes use the typed translator (`getRequestTranslator` or `useLocale`): `/`, `/partners`, `/signin`, `/clients`, `/clients/new`, `/command-center`, `/compliance`, `/cross-border`, `/engagements`, `/engagements/[id]`, `/expansion`, `/formation`, `/jurisdictions`, `/jurisdictions/[id]`, `/portal`, `/reports`, `/settings`. Missing catalog keys fall back to English with a development warning. Automated coverage: catalog key/placeholder parity and preview-copy checks (`tests/i18n*.test.ts`); browser coverage exists only for `/` and `/partners` (below). Authenticated routes need a database and sign-in and have no browser tests.

### Changes

- `DocumentEvidencePanel` and `EvidenceBadge` are now client components using `evidencePanel.*` keys (status, class labels, missing/warning items, confidence as a locale-formatted percentage). Evidence data, `assessEvidence` output and domain labels are unchanged; unknown items fall back to the raw English string.
- `apiError.*` grew from about 30 to about 150 mapped messages (permissions, not-found, concurrency, invalid input, workflow gates, portal, generic failures). Operational and internal messages (workers, scanner callbacks, storage/configuration, OIDC provisioning, dead letters) are intentionally not mapped so internals are not surfaced; they stay English. Response bodies and status codes are unchanged; unmapped messages pass through in English.
- `validation.summary` and `validation.field` added for field-level validation text. Zod `issues` details are not displayed by clients (except the partnership form's translated generic message) and remain English in API responses.
- New tests in `tests/i18n-evidence-api.test.ts`: key and placeholder parity in all locales, evidence translations, domain-label alignment, every mapped API error translated, English fallback, and validation interpolation.

### Browser testing

`playwright.config.ts` and `e2e/i18n.spec.ts` run against a production build (`NEXTAUTH_SECRET=build-validation-only npm run build`, then `npm run test:e2e`). Prerequisites in a fresh environment: `npx playwright install chromium` and `sudo npx playwright install-deps chromium` (system libraries such as libatk were missing initially). Tests cover language selection and `lang` persistence, `/partners` form-state preservation across a switch, no horizontal overflow at 375/768/1440 px for all four locales on `/` and `/partners`, and keyboard focus of the selector. These are automated checks, not an accessibility certification; screen-reader and visual review are outstanding.

### Remaining limitations

Internal/operational API errors, Zod `issues`, and user-entered or stored text are not translated. Authenticated screens lack browser tests. No locale-prefixed URLs or `hreflang`. fr, pt and es remain preview languages pending native-language and legal/tax/compliance review.

## Controlled terminology (glossary)

`lib/i18n/glossary.ts` is the single source for standardised translations of legally and operationally sensitive terms, enforced by `tests/i18n-glossary.test.ts` (disallowed variants fail the build; approved terms must appear in the sensitive `apiError.*` messages). Status: **unreviewed**. The table is a consistency baseline derived from the existing catalogs, not a legal or native-language opinion.

| Concept | fr | pt | es |
| --- | --- | --- | --- |
| professional review | revue professionnelle | revisão profissional | revisión profesional |
| jurisdiction | juridiction | jurisdição | jurisdicción |
| obligation | obligation | obrigação | obligación |
| evidence | preuve | evidência | evidencia |
| supporting document | document justificatif | documento comprovativo | documento justificativo |
| compliance | conformité | conformidade | cumplimiento |
| formation roadmap | feuille de route | roteiro | hoja de ruta |
| cross-border | transfrontalier | transfronteiriço | transfronterizo |

Standardised in this pass: French "examen professionnel"/"examen par un professionnel" became "revue professionnelle" (with gender agreement corrected), and French evidence labels "justificatif(s)" and "éléments probants" became "preuve(s)"; Portuguese "análise profissional" became "revisão profissional".

Questions the qualified reviewers must settle (not decided here): pt-PT versus pt-BR conventions (the catalog currently follows pt-PT forms such as "registo"); es-ES versus Latin American usage and whether "evidencia" or "prueba" is preferred in legal contexts; whether "revue professionnelle" is the right register in each target jurisdiction; any jurisdiction-specific statutory terms, which must come from authoritative sources and not from this glossary.

### Recording a review

Each locale needs a dated entry (reviewer name and qualification, scope: whole catalog or keys, glossary approved or amended, date) in the pull request that changes `lib/i18n/config.ts`. Legal/tax/compliance reviewers sign off separately on `trust.*`, `crossBorder.*`, `expansion.*`, `marketEntry.readinessText.boundary` and `apiError.*` permission messages. Only after both records exist may `GLOSSARY_REVIEW_STATUS` and the locale status change.

## Release readiness (feature/i18n-release-readiness)

**Status: NO-GO for promoting fr, pt or es to fully supported.** English is the default. A controlled preview release (language selector labelled "preview", pages not locale-indexed) is technically supportable once the PR order below is merged and CI is green. Promotion is blocked by human reviews that engineering cannot supply.

### Integration order

1. PR #2 (`feature/i18n-remaining-audit` → `main`).
2. PR #3 (`feature/i18n-glossary`), currently based on #2; retarget to `main` after #2 merges.
3. This branch (`feature/i18n-release-readiness`), currently based on #3; retarget after #3 merges.
No file conflicts were found between them (each builds linearly on the previous). None is merged without human approval.

### Route coverage

All 17 `page.tsx` routes use the typed translator. Stray hardcoded text found and fixed in this pass: the client-portal "Request authenticated acknowledgment" button (`app.portal.requestAcknowledgment`) and `ComparisonMatrix` (currently unused; now localized). Remaining non-translated strings are deliberate: brand name "PIEROLOOS" in the boot layer, an IANA time-zone placeholder, a URL placeholder. `components/shell/Boot layer.tsx` is a tracked stray file with a space in its name that is not imported anywhere and differs from `BootLayer.tsx`; it was left untouched and should be removed in a separate reviewed change. Emails and generated documents: outgoing email exists (`lib/services/notification-email.ts`, `notification-worker.ts`, `compliance-notification.ts`, `partnership-inquiry-service.ts`). Recipient-language delivery is implemented for the operational-escalation email (see "Email localization" below); the partnership-inquiry alert to the platform reviewer remains English-only by design (internal recipient, no stored locale). Generated report/document text was not audited for this item.

| Area | Catalog coverage | Browser coverage | Human review |
| --- | --- | --- | --- |
| `/`, `/partners` | Yes | Yes (selector, lang, query/route, form state, overflow, zoom, axe) | Outstanding |
| `/signin`, 404, signed-out protected routes | Yes | Lang and overflow only | Outstanding |
| `/clients`, `/clients/new`, `/jurisdictions*`, `/formation`, `/compliance`, `/cross-border`, `/expansion`, `/engagements*`, `/portal`, `/reports`, `/settings`, `/command-center` | Yes | None (needs OIDC test identity provider and seeded data) | Outstanding |
| Outgoing emails | Escalation email localized from stored recipient locale; partnership alert English | `tests/notification-email-locale.test.ts` | Migration unverified against a real database locally (runs in CI); fr/pt/es wording unreviewed |
| API errors | About 150 mapped; internal/operational deliberately English | n/a | Outstanding for permission messages |

### Governance

Catalog key and placeholder parity, glossary consistency, preview-copy checks, and a promotion gate run in `npm test`. `lib/i18n/review-records.ts` is the append-only record of native-language, legal, tax/accounting and compliance reviews per locale (reviewer, qualification, date, glossary version, outcome, regional variant, unresolved questions). It is empty. `tests/i18n-release-gate.test.ts` fails if any locale is marked supported without a complete, non-rejected record for every scope. Regional choices (pt-PT vs pt-BR, Spanish variant, French register) are not decided by engineering and are listed for reviewers above.

### SEO decision

Locales share unprefixed URLs and are selected by the `pieroloos-locale` cookie. Crawlers send no cookie, so only English is ever indexed; only `/` and `/partners` are indexable and all other routes are `noindex`. There are no duplicate locale URLs and no `hreflang`, which is correct while fr/pt/es are previews. Consequence: no localized search presence. Before any localized indexing, adopt locale-prefixed URLs (for example `/fr/partners`) with self-referencing canonicals, reciprocal `hreflang` including `x-default`, and sitemap entries, and only for locales that have passed review. A browser test asserts no `hreflang` or locale paths are exposed today.

### Security and privacy review

No changes to `lib/auth` or `app/api` versus `main`. The locale cookie holds only a validated locale code (`SameSite=Lax`, `Secure` over HTTPS, one year, not HttpOnly because the client sets it); unknown values fall back to English and a browser test confirms an injected value is rejected. Catalog values contain no markup and interpolated values render as escaped React text; the only `dangerouslySetInnerHTML` is JSON-LD with `<` escaped. No external translation service is used or added. Browser tests confirm locale state does not leak between browser contexts. Not verified here: CSRF, rate limiting, upload validation and workspace isolation were not exercised by browser tests; they are unchanged by this work and covered only by the existing unit and database tests.

### Accessibility

Automated: axe-core (WCAG 2.0/2.1/2.2 A and AA rule tags) on `/` and `/partners` in all four locales reports no violations; the selector is keyboard reachable with a visible focus style; 200% text zoom does not overflow `/partners`; no horizontal overflow at 375, 768 and 1440 px. This is **not** a WCAG conformance or certification claim. Outstanding human review: screen-reader announcement of language changes and form errors, focus management after navigation, colour contrast beyond axe's automated checks, and authenticated screens.

### Performance

All four catalogs ship to the client in one shared chunk (about 322 KB raw, about 80 KB gzipped in the measured production build, including other shared code), because `LocaleProvider` imports every catalog. Acceptable for a preview but a candidate optimization (per-locale dynamic loading) before wide release. Not measured: locale-switch latency, hydration errors on authenticated routes, CDN caching behaviour, and any deployed environment. Because locale is read from a request cookie, responses that vary by locale must not be cached as shared public pages; confirm `Vary: Cookie`/no-store behaviour on the deployed CDN.

### Test commands and actual results (this branch, Codespaces)

- `npm test`: 307 passed, 7 skipped.
- `npm run lint`: clean. `npm run typecheck`: clean. `git diff --check`: clean.
- `NEXTAUTH_SECRET=build-validation-only npm run build`: succeeded.
- `npm run test:e2e` (after `npx playwright install --with-deps chromium` and a production build): 32 passed (24 behaviour/layout tests plus 8 axe scans).
- `npm run test:db`: **not run** here (no PostgreSQL server in this environment); it runs in CI.
- CI (`.github/workflows/ci.yml`) now runs lint and a separate `e2e` job that installs Chromium with system dependencies, builds, and runs `npm run test:e2e`. These CI changes are unproven until the workflow runs on GitHub.

### Deployment and rollback

Deploy only after PRs merge and CI is green. No database migration or environment variable is added by the i18n work. Rollback: revert the merge commit; the cookie is harmless to older builds (ignored). Production acceptance, to be done by the release owner on the deployed environment: confirm `lang` and metadata per locale, selector behaviour, no hydration errors in browser console, response caching by locale, sign-in via the real identity provider with each locale, and error monitoring.

### Release evidence matrix

| Requirement | Status | Evidence | Reviewer | Blocker |
| --- | --- | --- | --- | --- |
| Catalog and placeholder parity | Met | `tests/i18n*.test.ts` | Engineering | None |
| Glossary consistency | Met (unreviewed content) | `tests/i18n-glossary.test.ts` | Pending | Native/legal review |
| Native-language review fr / pt / es | Not met | `REVIEW_RECORDS` empty | Pending | Qualified reviewers |
| Legal, tax, compliance terminology | Not met | None | Pending | Qualified reviewers |
| Public route browser tests | Met locally | 32 Playwright tests | Engineering | CI run pending |
| Authenticated route browser tests | Not met | None | n/a | OIDC test IdP, seed data |
| Automated accessibility | Met for 2 public routes | axe scans | Engineering | Not certification |
| Manual keyboard and screen-reader review | Not met | None | Pending | Human tester |
| SEO strategy | Decided | Section above | Engineering | Needs approval |
| Security review | Partial | Code review plus tests | Engineering | Dynamic testing outstanding |
| Performance | Partial | Bundle measurement | Engineering | Deployed measurements |
| DB integrity check | Not run locally | CI job | Engineering | CI result |
| Production verification | Not met | None | Release owner | Deployed environment |

### Release approval criteria

Fully supported status for a locale requires all of: complete review records for every scope in `REVIEW_RECORDS`; recorded regional-variant decisions; authenticated-route browser tests passing in CI; manual accessibility sign-off; green CI including the e2e job; deployed-environment acceptance; and explicit release-owner approval. Until then fr, pt and es remain preview.

Verification (Node, vitest, lint, `tsc`, production build with a disposable `NEXTAUTH_SECRET`): `npm test` 244 passed / 7 skipped, lint and typecheck clean, build succeeded. (Earlier pass; see the remaining-audit section for later results.) fr, pt and es remain preview languages pending qualified human review, especially the market-entry and cross-border boundary disclaimers.


## Email localization

Approved schema change (additive migration `20261012000000_notification_recipient_locale`):

- `NotificationPreference.locale` (`TEXT NOT NULL DEFAULT 'en'`): the recipient's notification language, set in the notification preferences form and the existing preferences API (`locale` is optional and validated against the language registry).
- `ComplianceNotification.templateParams` (`JSONB`, nullable): the values (`title`, `level`) used to render the email.

Behaviour: the stored `subject` and `body` remain English and are the fallback. At send time the worker reads the recipient's locale and re-renders the template from the catalog (`lib/i18n/email-templates.ts`). Legacy rows without params, unknown templates, invalid params and unknown locales all send the stored English text. Stored params are re-validated at render time, content is HTML-escaped, and the HTML carries a matching `lang` attribute. Notifications queued before the migration are delivered in English. In-app notifications are unchanged. Rollback: the columns are unused by older code and can be left in place; reverting the application code restores English-only email.

The French, Portuguese and Spanish email strings are preview text and fall under the same pending native-language and legal/compliance reviews as the rest of the catalogs.
