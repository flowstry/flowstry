"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AuthActionButton from "./AuthActionButton";

export default function StickyHeader({ appUrl }: { appUrl: string }) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setIsScrolled(window.scrollY > 100);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <header
      className={`sticky w-[95%] lg:w-3/4 m-auto duration-600 transition-all top-0 z-50  ${
        isScrolled
          ? " bg-[#1f1f1f]/80 backdrop-blur-sm top-5 rounded-2xl shadow-2xl"
          : "border-transparent bg-transparent"
      }`}
    >
      <div className={`mx-auto flex w-full max-w-6xl items-center lg:justify-between ${isScrolled ? 'justify-center' : 'justify-between'} px-6 py-4`}>
        <div className="flex items-center gap-3">
          <img src="/logo.svg" alt="Flowstry logo" className="h-9 w-9" />
          <span className="text-lg font-semibold tracking-wide">Flowstry</span>
        </div>
        <nav className="hidden items-center gap-6 text-sm text-neutral-300 lg:flex">
          <a href="#features" className="transition hover:text-white">
            Features
          </a>
          <a href="#library" className="transition hover:text-white">
            Library
          </a>
          <a href="#workspaces" className="transition hover:text-white">
            Workspaces
          </a>
          <a href="#use-cases" className="transition hover:text-white">
            Use cases
          </a>
        </nav>
        <div className="hidden lg:flex items-center gap-3">
          <Link
            href={appUrl}
            className="btn-glow rounded-full bg-[var(--primary)] px-5 py-2 text-sm font-semibold text-[#0f2a26]"
          >
            Start diagramming
          </Link>
          <AuthActionButton className="hidden sm:inline-flex" />
        </div>
      </div>
    </header>
  );
}
