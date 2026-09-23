 "use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Search, ShieldCheck, X } from "lucide-react";
import { useState } from "react";
import { systemNavigation, workspaceNavigation } from "@/lib/navigation";
import { cx } from "@/components/ui/primitives";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navigation = [...workspaceNavigation, ...systemNavigation];

  return (
    <div className="app-shell">
      <div className="app-backdrop" aria-hidden="true">
        <div className="star-field" />
        <div className="ambient-orbit ambient-orbit-a" />
        <div className="ambient-orbit ambient-orbit-b" />
      </div>

      <aside className={cx("sidebar", mobileOpen && "sidebar-open")}>
        <div className="brand-lockup">
          <Image
            src="/brand/pierolocorp-logo.webp"
            alt="PieroloCorp"
            width={44}
            height={44}
            className="brand-logo"
          />
          <div>
            <div className="brand-name">PIEROLOOS</div>
            <div className="brand-subtitle">Corporate Intelligence</div>
          </div>
          <button className="icon-button mobile-close" onClick={() => setMobileOpen(false)} aria-label="Close navigation">
            <X size={19} />
          </button>
        </div>

        <div className="workspace-label">WORKSPACE</div>
        <nav aria-label="Primary navigation">
          {navigation.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cx("nav-item", active && "nav-active")}
              >
                <Icon size={18} strokeWidth={1.8} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="system-health">
            <span className="status-dot" />
            <span>Core systems nominal</span>
          </div>
          <div className="version">PIEROLOOS v0.1 FOUNDATION</div>
        </div>
      </aside>

      {mobileOpen ? <button className="mobile-scrim" onClick={() => setMobileOpen(false)} aria-label="Close navigation" /> : null}

      <main className="main-shell">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
              <Menu size={20} />
            </button>
            <div className="context-path">
              <span>Workspace</span>
              <span>/</span>
              <strong>{navigation.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))?.label ?? "Overview"}</strong>
            </div>
          </div>
          <div className="topbar-actions">
            <button className="search-button" aria-label="Search workspace">
              <Search size={17} />
              <span>Search</span>
              <kbd>⌘ K</kbd>
            </button>
            <div className="security-state">
              <ShieldCheck size={16} />
              <span>Protected workspace</span>
            </div>
            <div className="avatar" aria-label="Current user">JE</div>
          </div>
        </header>
        <div className="workspace">{children}</div>
      </main>
    </div>
  );
}
