import Link from "next/link";
import { BRAND_TAGLINE, BrandLogo } from "@/components/brand/BrandLogo";
import { publicNavigation } from "@/lib/navigation";

export function PublicHeader() {
  return (
    <header className="public-header">
      <div className="public-container public-header-inner">
        <Link href="/" aria-label="PieroloOS home">
          <BrandLogo size="sm" />
        </Link>
        <nav aria-label="Public navigation" className="public-nav">
          {publicNavigation.map((item) => (
            <Link key={item.href} href={item.href}>{item.label}</Link>
          ))}
        </nav>
        <Link href="/signin" className="button button-secondary public-signin">Sign in</Link>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="public-footer">
      <div className="public-container">
        <div className="public-footer-grid">
          <div>
            <BrandLogo size="sm" />
            <p className="public-footer-tagline">{BRAND_TAGLINE}</p>
          </div>
          <nav aria-label="Footer navigation">
            <h2 className="public-footer-heading">Explore</h2>
            <ul>
              {publicNavigation.map((item) => (
                <li key={item.href}><Link href={item.href}>{item.label}</Link></li>
              ))}
            </ul>
          </nav>
          <nav aria-label="Get started">
            <h2 className="public-footer-heading">Get started</h2>
            <ul>
              <li><Link href="/signin?callbackUrl=/clients/new">Start Your Business Journey</Link></li>
              <li><Link href="/partners#partner-with-us">Partner With Us</Link></li>
              <li><Link href="/signin">Sign in</Link></li>
            </ul>
          </nav>
        </div>
        <p className="public-disclaimer">
          PieroloOS organizes information, prepares drafts and analyses, and supports human review. It is software, not a law firm,
          tax adviser, accounting firm or financial adviser, and it does not guarantee incorporation, registration or approval outcomes.
          Consult qualified professionals before acting on any jurisdiction, tax or compliance information.
        </p>
        <p className="public-copyright">&copy; {new Date().getFullYear()} PieroloOS. All rights reserved.</p>
      </div>
    </footer>
  );
}

export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="public-shell">
      <a href="#main-content" className="skip-link">Skip to main content</a>
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
