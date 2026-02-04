"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AuthActionButton from "./AuthActionButton";

export default function MobileStickyCta({
  appUrl,
  heroCtaId = "hero-cta",
  hideOnId = "cta-final",
}: {
  appUrl: string;
  heroCtaId?: string;
  hideOnId?: string;
}) {
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => {
    const updateVisibility = () => {
      const heroTarget = document.getElementById(heroCtaId);
      const hideTarget = document.getElementById(hideOnId);
      if (!heroTarget) {
        setIsVisible(false);
        return;
      }

      const heroRect = heroTarget.getBoundingClientRect();
      const heroOutOfView = heroRect.bottom < 0;

      let hideInView = false;
      if (hideTarget) {
        const hideRect = hideTarget.getBoundingClientRect();
        const isVisible =
          hideRect.top <= window.innerHeight - 80 && hideRect.bottom >= 0;
        hideInView = isVisible;
      }

      setIsVisible(heroOutOfView && !hideInView);
    };

    updateVisibility();
    window.addEventListener("scroll", updateVisibility, { passive: true });
    window.addEventListener("resize", updateVisibility);
    return () => {
      window.removeEventListener("scroll", updateVisibility);
      window.removeEventListener("resize", updateVisibility);
    };
  }, [heroCtaId, hideOnId]);

  return (
    <div
      className={`lg:hidden fixed inset-x-0 bottom-4 z-50 px-4 transition-all ${
        isVisible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0 pointer-events-none"
      }`}
    >
      <div className="mx-auto flex w-full max-w-[420px] items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#1f1f1f]/90 px-4 py-3 shadow-2xl backdrop-blur-md">
        <Link
          href={appUrl}
          className="btn-glow flex-1 rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[#0f2a26] text-center"
        >
          Start diagramming
        </Link>
        <AuthActionButton />
      </div>
    </div>
  );
}
