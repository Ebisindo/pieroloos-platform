# Internationalization

## Current scope and language status

English remains the default. The locale selector is available on public pages and in the authenticated workspace, keeps the current unprefixed URL and query string, and stores only the validated locale code in a one-year, same-site cookie. Switching locale does not reset form state, change workflow values, or alter authentication and authorization.

The catalogs are wired to the homepage and partnership page, public navigation and footer, the partnership inquiry form, sign-in, the workspace shell, client intake, client portal, dashboard and notifications, jurisdiction comparisons and detail view, formation workflow, compliance control center and obligations, report placeholder, and workspace settings. The business profile is captured through the existing intake and jurisdiction comparison flows; no standalone business-profile route exists in this checkout.

This is not complete localization of every application surface. Market expansion, cross-border preparation, engagement screens, and some less frequently used workflow/support copy still contain English. Dynamic names, user-entered notes and statements, notification subject/body text already stored in the database, and human-readable error messages returned by APIs are deliberately not rewritten by the UI translator. These omissions do not change API contracts or stored records.

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

Maintain consistent terminology for jurisdiction, formation roadmap, evidence, obligation, professional review and cross-border preparation. Preserve meaning, provenance limitations, uncertainty, qualifications, warnings, privacy statements and disclaimers. Never translate machine-readable identifiers, API values, stored workflow/user data, protected product names or official legal entity names. API-originated error messages may remain in their source language.

Legal-, tax-, accounting-, investment- and jurisdiction-sensitive localized content requires qualified native-language and subject-matter review before publication as authoritative. Translation must not convert observations into legal conclusions or alter business rules. Funding figures remain in Nigerian naira and are not currency-converted by locale formatting. No translation service or external API is part of this architecture.

## Remaining decisions and deployment

No additional i18n deployment configuration or migration is required. The preference uses the `pieroloos-locale` cookie (`Path=/`, `SameSite=Lax`, one-year expiry, `Secure` on HTTPS) and does not store user identity or workflow data. Do not infer that locale changes jurisdiction, regulatory obligations, payment availability or the business's legal location.

Before promoting a proposed locale from preview, translate remaining application surfaces and supporting content, obtain qualified native-speaker and relevant subject-matter review of legal-, tax-, investment- and jurisdiction-sensitive wording, review long-text layouts, and verify the resulting catalog and flows. Consider locale-prefixed URLs and `hreflang` only as a separate SEO/routing decision; do not change callback URLs or route contracts as part of this stage.

## Quality audit status

The four catalogs have matching key sets and interpolation placeholders. Missing catalog entries fall back to English and emit a development warning. The Spanish homepage secondary action is localized as “Explorar PieroloOS”.

Locale variants share the existing cookie-selected, unprefixed routes and canonical URLs; there are no conflicting locale URLs or `hreflang` alternates. The language preference is reflected in the document `lang` attribute, and all currently configured locales use left-to-right text. Automated tests do not provide visual, keyboard, screen-reader, or device-size certification. Market expansion, cross-border preparation, engagement screens, some workflow/support copy, and API-originated error text still require localization or deliberate source-language handling. Proposed locales remain previews until both coverage and qualified human review are complete.
