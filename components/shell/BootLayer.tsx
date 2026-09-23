 "use client";

import Image from "next/image";
import { useEffect, useState } from "react";

export function BootLayer({ children }: { children: React.ReactNode }) {
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

  return (
    <>
      <div className={`boot-layer ${hidden ? "boot-hidden" : ""}`} aria-hidden={hidden}>
        <div className="cosmic-grid" />
        <div className="boot-orbit boot-orbit-one" />
        <div className="boot-orbit boot-orbit-two" />
        <div className="boot-core">
          <Image
            src="/brand/pierolocorp-logo.webp"
            alt=""
            width={180}
            height={180}
            priority
            className="boot-logo"
          />
          <div className="boot-product">PIEROLOOS</div>
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
