import {
  ArrowRight, // Added for Export
  BoxSelect,
  CheckCircle2,
  Cloud, // Added for Hand-drawn
  Download,
  Folder, Laptop,
  LayoutGrid, // Added for Live Collab
  PenTool, // Added for Frames
  Sparkles,
  Users
} from "lucide-react";
import Link from "next/link";
import AuthActionButton from "./components/AuthActionButton";
import Footer from "./components/Footer";
import MobileStickyCta from "./components/MobileStickyCta";
import StickyHeader from "./components/StickyHeader";

const primaryCta = process.env.NEXT_PUBLIC_APP_URL || "/";

const featureHighlights = [
  {
    icon: Laptop,
    title: "Local-first canvas",
    description: "Start creating instantly with no login required. Your ideas stay on-device.",
  },
  {
    icon: Users,
    title: "Live collaboration",
    description: "Multiplayer editing with real-time cursor presence and instant sync.",
  },
  {
    icon: PenTool,
    title: "Hand-drawn style",
    description: "Switch to hand-drawn style for low-fidelity brainstorming/whiteboarding.",
  },
  {
    icon: LayoutGrid,
    title: "Structured diagramming",
    description: "Precise layouts, connectors, and aligned components for clean system maps.",
  },
  {
    icon: Folder,
    title: "Workspaces & folders",
    description: "Organize diagrams by team, project, or architecture layer.",
  },
  {
    icon: Cloud,
    title: "Cloud sync",
    description: "Sign up to sync across devices and keep everything in one place.",
  },
  {
    icon: BoxSelect,
    title: "Frames & grouping",
    description: "Group elements into logical frames to structure large architecture diagrams.",
  },
  {
    icon: Download,
    title: "Export & share",
    description: "Export to PNG/SVG or share your workspace with your team.",
  },
  {
    icon: Sparkles,
    title: "Shape library",
    description: "AWS, GCP, Azure, and Kubernetes shapes included out of the box.",
  },
];

const useCases = [
  "System architecture and infrastructure planning",
  "Service topology and data flow mapping",
  "API design and integration diagrams",
  "Team brainstorming and technical whiteboarding",
];

export default function HomePage() {
  return (
    <main className="relative">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,#2b2b2b,transparent_55%)]" />
      <div className="absolute inset-0 -z-10 dot-grid opacity-60" />

      <StickyHeader appUrl={primaryCta} />
      <MobileStickyCta appUrl={primaryCta} />

      <section className="mx-auto flex w-full max-w-6xl flex-col items-start gap-10 px-6 pb-20 pt-12 md:flex-row md:items-center md:pb-24">
        <div className="flex-1 space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-neutral-200">
            <span className="h-2 w-2 rounded-full bg-[var(--primary)]" />
            Early access · Design systems where flow meets structure
          </div>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight text-white md:text-5xl">
            The system architecture canvas for developers who need
            <span className="text-gradient-primary"> flow</span> and structure.
          </h1>
          <p className="max-w-xl text-base text-neutral-300 md:text-lg">
            A modern diagramming tool that blends whiteboarding with structured system design.
            Start locally, then move into cloud workspaces when you are ready to share.
          </p>
          <div id="hero-cta" className="flex flex-wrap items-center gap-3">
            <Link
              href={primaryCta}
              className="btn-glow inline-flex items-center gap-2 rounded-full bg-[var(--primary)] px-6 py-3 text-sm font-semibold text-[#0f2a26]"
            >
              Start diagramming
              <ArrowRight className="h-4 w-4" />
            </Link>
            <AuthActionButton />
          </div>

        </div>

        <div className="relative flex-1">
          <div className="absolute -left-10 top-10 h-32 w-32 rounded-full bg-[var(--primary)]/20 blur-3xl" />
          <div className="absolute -right-8 bottom-10 h-40 w-40 rounded-full bg-[var(--primary)]/10 blur-3xl" />
          <div className="glass-card relative overflow-hidden rounded-3xl border border-white/10 p-6">
            <div className="flex items-center justify-between text-xs text-neutral-400">
              <span>Flowstry canvas</span>
              <span className="rounded-full bg-white/10 px-2 py-1">Workspace ready</span>
            </div>
            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-[var(--primary)]/15" />
                <div className="space-y-2">
                  <div className="h-3 w-36 rounded-full bg-white/10" />
                  <div className="h-2 w-28 rounded-full bg-white/5" />
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#1f1f1f] p-4">
                <div className="flex items-center justify-between text-xs text-neutral-400">
                  <span>Architecture flow</span>
                  <span className="text-[var(--primary)]">Library panel</span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3">
                  {["API", "Queue", "DB", "Cache", "Service", "Gateway"].map((label) => (
                    <div
                      key={label}
                      className="flex h-16 flex-col items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 text-[11px] text-neutral-200"
                    >
                      <div className="h-4 w-4 rounded bg-[var(--primary)]/60" />
                      {label}
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-neutral-300">
                Drag structured shapes, connect flows, and annotate decisions in seconds.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto w-full max-w-6xl px-6 pb-20">
        <div className="flex flex-col gap-4">
          <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Features</p>
          <h2 className="text-3xl font-semibold text-white md:text-4xl">
            Built for system architecture, designed for clarity
          </h2>
          <p className="max-w-2xl text-sm text-neutral-300 md:text-base">
            Flowstry combines a flexible whiteboard with structured diagramming so engineers
            can map complex systems without losing flow.
          </p>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {featureHighlights.map((feature) => (
            <div key={feature.title} className="glass-card rounded-2xl p-6">
              <feature.icon className="h-6 w-6 text-[var(--primary)]" />
              <h3 className="mt-4 text-lg font-semibold text-white">{feature.title}</h3>
              <p className="mt-2 text-sm text-neutral-300">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="library" className="mx-auto w-full max-w-6xl px-6 pb-20">
        <div className="grid gap-10 rounded-3xl border border-white/10 bg-white/5 p-8 md:grid-cols-2 md:items-center">
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Architecture library</p>
            <h2 className="text-3xl font-semibold text-white md:text-4xl">
              A structured shape library for modern systems
            </h2>
            <p className="text-sm text-neutral-300 md:text-base">
              Drag cloud, data, and infrastructure shapes from the library panel. Flowstry includes
              AWS, GCP, Azure, and Kubernetes libraries for fast, consistent architecture diagrams.
            </p>
            <div className="grid gap-3 text-sm text-neutral-300">
              {["AWS, GCP, Azure, and Kubernetes shapes", "Architecture-ready components", "Built for system design workflows"].map((item) => (
                <span key={item} className="inline-flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[var(--primary)]" />
                  {item}
                </span>
              ))}
            </div>
          </div>
          <div className="grid gap-3 rounded-2xl border border-white/10 bg-[#1d1d1d] p-5 text-sm text-neutral-300">
            <div className="flex items-center justify-between">
              <span className="text-xs text-neutral-500">Library panel</span>
              <span className="rounded-full bg-white/10 px-2 py-1 text-xs">System shapes</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {["Compute", "Database", "Queue", "Cache", "Load balancer", "Storage"].map((label) => (
                <div key={label} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                  <div className="h-2 w-10 rounded-full bg-[var(--primary)]/60" />
                  <p className="mt-3 text-xs text-neutral-300">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="workspaces" className="mx-auto w-full max-w-6xl px-6 pb-20">
        <div className="grid gap-10 md:grid-cols-2 md:items-center">
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Workspaces</p>
          <h2 className="text-3xl font-semibold text-white md:text-4xl">
              Cloud workspaces that keep system design organized
            </h2>
            <p className="text-sm text-neutral-300 md:text-base">
              Create a free account to unlock cloud workspaces, folders, and saved diagrams
              that sync across devices.
            </p>
            <div className="grid gap-3 text-sm text-neutral-300">
              {["Free accounts with cloud workspaces", "Folders and diagrams to stay organized", "Sync across devices"].map((item) => (
                <span key={item} className="inline-flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[var(--primary)]" />
                  {item}
                </span>
              ))}
            </div>
          </div>
          <div className="grid gap-4">
            <div className="glass-card rounded-2xl border border-[var(--primary)]/30 p-5">
              <div className="flex items-center justify-between text-xs text-neutral-400">
                <span>Cloud workspace</span>
                <span className="rounded-full bg-[var(--primary)]/20 px-2 py-1 text-[var(--primary)]">Synced</span>
              </div>
              <div className="mt-4 space-y-3">
                {["Payments platform", "Identity services", "Streaming pipeline"].map((item) => (
                  <div key={item} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                    <span className="text-sm text-neutral-200">{item}</span>
                    <span className="text-xs text-neutral-500">Shared workspace</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="use-cases" className="mx-auto w-full max-w-6xl px-6 pb-24">
        <div className="grid gap-8 rounded-3xl border border-white/10 bg-[#1b1b1b] p-8 md:grid-cols-2 md:items-center">
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Use cases</p>
            <h2 className="text-3xl font-semibold text-white md:text-4xl">
              From brainstorm to production architecture
            </h2>
          <p className="text-sm text-neutral-300 md:text-base">
            Flowstry helps backend engineers, architects, and DevOps teams document
            complex systems without losing the technical detail.
          </p>
            <Link
              href={primaryCta}
              className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--primary)]"
            >
              Start designing now
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid gap-3 text-sm text-neutral-300">
            {useCases.map((item) => (
              <span key={item} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <CheckCircle2 className="h-4 w-4 text-[var(--primary)]" />
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section id="cta-final" className="mx-auto w-full max-w-6xl px-6 pb-20">
        <div className="flex flex-col items-center gap-6 rounded-3xl border border-white/10 bg-gradient-to-r from-[#203230] via-[#1d2e2b] to-[#1b2423] px-8 py-12 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-neutral-300">Flowstry</p>
          <h2 className="text-3xl font-semibold text-white md:text-4xl">
            Ready to design your next system?
          </h2>
          <p className="max-w-2xl text-sm text-neutral-200 md:text-base">
            Start locally in seconds or sign up to unlock cloud workspaces, organization, and
            shared architecture diagrams.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href={primaryCta}
              className="btn-glow inline-flex items-center gap-2 rounded-full bg-[var(--primary)] px-6 py-3 text-sm font-semibold text-[#0f2a26]"
            >
              Start diagramming
              <ArrowRight className="h-4 w-4" />
            </Link>
            <AuthActionButton />
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}

