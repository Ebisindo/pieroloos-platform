 "use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { BRAND_TAGLINE, BrandLogo } from "@/components/brand/BrandLogo";
import { isPublicRoute } from "@/lib/navigation";

export function BootLayer({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const revealDelay = reduced ? 100 : 650;
    const timer = window.setTimeout(() => setReady(true), revealDelay);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(() => setHidden(true), 450);
    return () => window.clearTimeout(timer);
  }, [ready]);

  if (isPublicRoute(pathname)) return <>{children}</>;

  return (
    <>
      <noscript>
        <style>{".boot-layer{display:none}.app-hidden{opacity:1}"}</style>
      </noscript>
      <div className={`boot-layer ${hidden ? "boot-hidden" : ""}`} aria-hidden={hidden}>
        <div className="cosmic-grid" />
        <div className="boot-orbit boot-orbit-one" />
        <div className="boot-orbit boot-orbit-two" />
        <div className="boot-core">
          <BrandLogo variant="mark" size="xl" decorative priority />
          <div className="boot-product">PIEROLOOS</div>
          <div className="boot-tagline">{BRAND_TAGLINE}</div>
          <div className="boot-status">
            <span className="status-dot" />
            {ready ? "SYSTEM READY" : "INITIALIZING SYSTEM"}
          </div>
        </div>
      </div>
      <div className={hidden ? "app-revealed" : "app-hidden"}>{children}</div>
    </>
  );
}
