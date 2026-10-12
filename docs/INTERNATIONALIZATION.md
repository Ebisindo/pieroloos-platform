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

There are no separate contact, FAQ, privacy or terms routes/components in the current public website. Reports are currently an initialized placeholder rather than a generator. Server API response contracts and email templates are not translated by this frontend work.

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

Verification (Node, vitest, lint, `tsc`, production build with a disposable `NEXTAUTH_SECRET`): `npm test` 244 passed / 7 skipped, lint and typecheck clean, build succeeded. (Earlier pass; see the remaining-audit section for later results.) fr, pt and es remain preview languages pending qualified human review, especially the market-entry and cross-border boundary disclaimers.
