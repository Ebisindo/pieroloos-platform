 "use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Search, ShieldCheck, X } from "lucide-react";
import { useEffect, useState } from "react";
import { adminNavigation, isPublicRoute, portalNavigation, systemNavigation, workspaceNavigation } from "@/lib/navigation";
import { cx } from "@/components/ui/primitives";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { LanguageSelector } from "@/components/i18n/LanguageSelector";
import { locales } from "@/lib/i18n/config";
import type { MessageKey } from "@/lib/i18n/messages";

const navigationKeys = {
  "/command-center": "navigation.businessFormation",
  "/clients": "navigation.clients",
  "/jurisdictions": "navigation.jurisdictionLens",
  "/expansion": "navigation.marketExpansion",
  "/cross-border": "navigation.crossBorder",
  "/formation": "navigation.formation",
  "/compliance": "navigation.compliance",
  "/reports": "navigation.reports",
  "/engagements": "navigation.engagements",
  "/billing": "navigation.billing",
  "/settings": "navigation.settings",
  "/portal": "navigation.clientPortal",
  "/admin/dashboard": "navigation.adminControlCentre",
} as const satisfies Record<string, MessageKey>;

export function AppShell({
  children,
  canReadAdminDashboard = false,
}: {
  children: React.ReactNode;
  canReadAdminDashboard?: boolean;
}) {
  const { locale, t } = useLocale();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  if (isPublicRoute(pathname)) return <>{children}</>;

  const isClientPortal = pathname === "/portal" || pathname.startsWith("/portal/");
  const baseNavigation = isClientPortal
    ? portalNavigation
    : [...workspaceNavigation, ...systemNavigation];
  const navigation = canReadAdminDashboard
    ? [...baseNavigation, ...adminNavigation]
    : baseNavigation;

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">{t("navigation.skip")}</a>
      <div className="app-backdrop" aria-hidden="true">
        <div className="star-field" />
        <div className="ambient-orbit ambient-orbit-a" />
        <div className="ambient-orbit ambient-orbit-b" />
      </div>

      <aside id="primary-sidebar" className={cx("sidebar", mobileOpen && "sidebar-open")}>
        <div className="brand-lockup">
          <Link href="/" aria-label={t("navigation.home")} onClick={() => setMobileOpen(false)}>
            <BrandLogo size="md" />
          </Link>
          <button className="icon-button mobile-close" onClick={() => setMobileOpen(false)} aria-label={t("navigation.close")}>
            <X size={19} />
          </button>
        </div>

        <div className="workspace-label">{t(isClientPortal ? "navigation.clientPortal" : "navigation.workspace")}</div>
        <nav aria-label={t("navigation.primary")}>
          {navigation.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                onClick={() => setMobileOpen(false)}
                className={cx("nav-item", active && "nav-active")}
              >
                <Icon size={18} strokeWidth={1.8} />
                <span>{t(navigationKeys[item.href as keyof typeof navigationKeys])}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="system-health">
            <span className="status-dot" />
            <span>{t("navigation.coreSystems")}</span>
          </div>
          <div className="version">PIEROLOOS v0.1 FOUNDATION</div>
        </div>
      </aside>

      {mobileOpen ? <button className="mobile-scrim" onClick={() => setMobileOpen(false)} aria-label={t("navigation.close")} /> : null}

      <main id="main-content" className="main-shell">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button mobile-menu" onClick={() => setMobileOpen(true)} aria-label={t("navigation.open")} aria-expanded={mobileOpen} aria-controls="primary-sidebar">
              <Menu size={20} />
            </button>
            <div className="context-path">
              <span>{isClientPortal ? t("navigation.client") : t("navigation.workspace")}</span>
              <span>/</span>
              <strong>{(() => {
                const activeHref = navigation.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))?.href;
                return activeHref ? t(navigationKeys[activeHref as keyof typeof navigationKeys]) : t("navigation.overview");
              })()}</strong>
            </div>
          </div>
          <div className="topbar-actions">
            <button className="search-button" aria-label={t("navigation.search")}>
              <Search size={17} />
              <span>{t("navigation.searchText")}</span>
              <kbd>⌘ K</kbd>
            </button>
            <LanguageSelector />
            {locales[locale].status === "proposed" ? <span className="language-preview-chip">{t("language.preview")}</span> : null}
            <div className="security-state">
              <ShieldCheck size={16} />
              <span>{t(isClientPortal ? "navigation.protectedClient" : "navigation.protectedWorkspace")}</span>
            </div>
            <div className="avatar" aria-label={t("navigation.currentUser")}>JE</div>
          </div>
        </header>
        <div className="workspace">{children}</div>
      </main>
    </div>
  );
}
