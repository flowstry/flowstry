"use client";

import { Github } from "lucide-react";
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
        <Link href="/" className="flex items-center gap-3">
          <img src="/logo.svg" alt="Flowstry logo" className="h-9 w-9" />
          <span className="text-lg font-semibold tracking-wide">Flowstry</span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-neutral-300 lg:flex">
          <Link href="/#features" className="transition hover:text-white">
            Features
          </Link>
          <Link href="/#library" className="transition hover:text-white">
            Library
          </Link>
          <Link href="/#workspaces" className="transition hover:text-white">
            Workspaces
          </Link>
          <Link href="/#use-cases" className="transition hover:text-white">
            Use cases
          </Link>
          <Link href="/changelog" className="transition hover:text-white">
            Changelog
          </Link>
        </nav>
        <div className="hidden lg:flex items-center gap-3">
          <a
            href="https://x.com/FlowstryOffical"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-white/10 p-2 text-neutral-300 transition hover:bg-white/20 hover:text-white"
            aria-label="X"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              fill="currentColor"
              className="h-4 w-4"
            >
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>
          <a
            href="https://github.com/flowstry/flowstry"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-white/10 p-2 text-neutral-300 transition hover:bg-white/20 hover:text-white"
            aria-label="GitHub"
          >
            <Github className="h-5 w-5" />
          </a>
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
