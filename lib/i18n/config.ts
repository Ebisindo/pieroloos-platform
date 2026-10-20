export const DEFAULT_LOCALE = "en" as const;
export const LOCALE_COOKIE = "pieroloos-locale";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const locales = {
  en: { name: "English", htmlLang: "en", direction: "ltr", status: "default" },
  fr: { name: "Français", htmlLang: "fr", direction: "ltr", status: "proposed" },
  pt: { name: "Português", htmlLang: "pt", direction: "ltr", status: "proposed" },
  es: { name: "Español", htmlLang: "es", direction: "ltr", status: "proposed" },
} as const;

export type Locale = keyof typeof locales;

export function isLocale(value: string | undefined): value is Locale {
  return value !== undefined && Object.hasOwn(locales, value);
}

export function getLocale(value: string | undefined): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}
