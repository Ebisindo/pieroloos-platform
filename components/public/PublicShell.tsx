"use client";

import Link from "next/link";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { publicNavigation } from "@/lib/navigation";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { LanguageSelector } from "@/components/i18n/LanguageSelector";
import { locales } from "@/lib/i18n/config";

const navigationLabelKeys = [
  "navigation.journey",
  "navigation.capabilities",
  "navigation.professionals",
  "navigation.partners",
] as const;

export function PublicHeader() {
  const { locale, t } = useLocale();
  return (
    <header className="public-header">
      <div className="public-container public-header-inner">
        <Link href="/" aria-label={t("navigation.home")}>
          <BrandLogo size="sm" descriptor={t("brand.descriptor")} />
        </Link>
        <nav aria-label={t("navigation.public")} className="public-nav">
          {publicNavigation.map((item, index) => (
            <Link key={item.href} href={item.href}>{t(navigationLabelKeys[index])}</Link>
          ))}
        </nav>
        <LanguageSelector />
        <Link href="/signin" className="button button-secondary public-signin">{t("navigation.signIn")}</Link>
      </div>
      {locales[locale].status === "proposed" ? (
        <p className="locale-preview-notice" role="status">{t("language.reviewNotice")}</p>
      ) : null}
    </header>
  );
}

export function PublicFooter() {
  const { t } = useLocale();
  return (
    <footer className="public-footer">
      <div className="public-container">
        <div className="public-footer-grid">
          <div>
            <BrandLogo size="sm" descriptor={t("brand.descriptor")} />
            <p className="public-footer-tagline">{t("brand.tagline")}</p>
          </div>
          <nav aria-label={t("navigation.footer")}>
            <h2 className="public-footer-heading">{t("navigation.explore")}</h2>
            <ul>
              {publicNavigation.map((item, index) => (
                <li key={item.href}><Link href={item.href}>{t(navigationLabelKeys[index])}</Link></li>
              ))}
            </ul>
          </nav>
          <nav aria-label={t("navigation.getStarted")}>
            <h2 className="public-footer-heading">{t("navigation.getStarted")}</h2>
            <ul>
              <li><Link href="/signin?callbackUrl=/clients/new">{t("home.hero.primaryAction")}</Link></li>
              <li><Link href="/partners#partner-with-us">{t("partners.hero.primaryAction")}</Link></li>
              <li><Link href="/signin">{t("navigation.signIn")}</Link></li>
            </ul>
          </nav>
        </div>
        <p className="public-disclaimer">{t("footer.disclaimer")}</p>
        <p className="public-copyright">&copy; {new Date().getFullYear()} PieroloOS. {t("footer.copyright")}</p>
      </div>
    </footer>
  );
}

export function PublicShell({ children }: { children: React.ReactNode }) {
  const { t } = useLocale();
  return (
    <div className="public-shell">
      <a href="#main-content" className="skip-link">{t("navigation.skip")}</a>
      <div className="app-backdrop" aria-hidden="true">
        <div className="star-field" />
        <div className="ambient-orbit ambient-orbit-a" />
        <div className="ambient-orbit ambient-orbit-b" />
      </div>
      <PublicHeader />
      <main id="main-content">{children}</main>
      <PublicFooter />
    </div>
  );
}
