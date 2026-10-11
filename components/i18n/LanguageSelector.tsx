"use client";

import { useId } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isLocale, locales } from "@/lib/i18n/config";
import { createTranslator } from "@/lib/i18n/messages";
import { useLocale } from "./LocaleProvider";

export function LanguageSelector() {
  const id = useId();
  const pathname = usePathname();
  const router = useRouter();
  const { locale, setLocale, t } = useLocale();

  function onChange(value: string) {
    if (!isLocale(value)) return;
    setLocale(value);
    const translate = createTranslator(value);
    const publicPage = pathname === "/" || pathname === "/partners";
    if (publicPage) {
      const title = pathname === "/" ? translate("metadata.home.title") : `${translate("metadata.partners.title")} | PieroloOS`;
      const description = pathname === "/" ? translate("metadata.home.description") : translate("metadata.partners.description");
      document.title = title;
      document.querySelector('meta[name="description"]')?.setAttribute("content", description);
      document.querySelector('meta[property="og:title"]')?.setAttribute("content", title);
      document.querySelector('meta[property="og:description"]')?.setAttribute("content", description);
    }
    router.refresh();
  }

  return (
    <>
      <label className="visually-hidden" htmlFor={id}>{t("language.select")}</label>
      <select
        id={id}
        className="language-select"
        value={locale}
        onChange={(event) => onChange(event.currentTarget.value)}
        aria-label={t("language.select")}
      >
        {Object.entries(locales).map(([code, language]) => (
          <option key={code} value={code}>
            {language.name}{language.status === "proposed" ? ` (${t("language.preview")})` : ""}
          </option>
        ))}
      </select>
    </>
  );
}
