import { Github } from "lucide-react";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mx-auto w-full max-w-6xl px-6 pb-10 text-xs text-neutral-500">
      <div className="flex flex-col gap-4 border-t border-white/10 pt-6 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2">
          <span>Flowstry — Design systems where flow meets structure.</span>
          <span>© {new Date().getFullYear()} Flowstry</span>
        </div>
        <div className="flex items-center gap-6">
          <Link href="/changelog" className="transition hover:text-white">
            Changelog
          </Link>
          <a
            href="https://x.com/FlowstryOffical"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center transition hover:text-white"
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
            className="flex items-center transition hover:text-white"
            aria-label="GitHub"
          >
            <Github className="h-4 w-4" />
          </a>
        </div>
      </div>
    </footer>
  );
}
