import en from "./messages/en";
import es from "./messages/es";
import fr from "./messages/fr";
import pt from "./messages/pt";
import { DEFAULT_LOCALE, type Locale } from "./config";

export type MessageKey = keyof typeof en;
export type MessageCatalog = Record<MessageKey, string>;

export const messageCatalogs: Record<Locale, MessageCatalog> = { en, fr, pt, es };

export function findMissingMessageKeys(catalog: Partial<MessageCatalog>): MessageKey[] {
  return (Object.keys(en) as MessageKey[]).filter((key) => typeof catalog[key] !== "string");
}

export function createTranslator(
  locale: Locale,
  catalog: Partial<MessageCatalog> = messageCatalogs[locale],
  fallback: MessageCatalog = messageCatalogs[DEFAULT_LOCALE],
) {
  return (key: MessageKey, values?: Record<string, string | number>): string => {
    let message = catalog[key];
    if (typeof message !== "string") {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`Missing ${locale} translation: ${key}; using ${DEFAULT_LOCALE}.`);
      }
      message = fallback[key];
    }
    return message.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
      values && Object.hasOwn(values, name) ? String(values[name]) : placeholder,
    );
  };
}

export function formatNumber(value: number, locale: Locale, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(locale, options).format(value);
}

export function formatDate(value: Date | number, locale: Locale, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(locale, options).format(value);
}

export function formatCurrency(value: number, currency: string, locale: Locale): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(value);
}
