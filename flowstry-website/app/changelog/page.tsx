import Footer from "../components/Footer";
import StickyHeader from "../components/StickyHeader";

const releases = [
  {
    date: "February 2026",
    title: "Open Source Public Release",
    description: "Flowstry is now open source! We believe in building in public and empowering the community to shape the future of system diagramming.",
    features: [
      "Public GitHub Repository",
      "Community contributions enabled",
      "MIT License",
      "Transparent roadmap",
    ],
  },
  {
    date: "January 2026",
    title: "Early Access & Live Collaboration",
    description: "The official Early Access release introducing real-time multiplayer editing, workspaces, and authentication.",
    features: [
      "Live Collaboration with cursor presence",
      "Cloud Workspaces & Folders",
      "Authentication & User Profiles",
      "Library Panel improvements",
      "Hand-drawn stroke style",
      "Frames for grouping elements",
    ],
  },
  {
    date: "December 2025",
    title: "Advanced Interactions & Connectors",
    description: "Major updates to the connector engine and interaction model.",
    features: [
      "Group selection & inner grouping",
      "Help & Keyboard shortcuts menu",
      "Tech Icon shapes & Service cards",
      "Advanced connector routing (curved & bent)",
      "Connector labels & text",
      "Canvas themes & settings",
      "Image shape support",
    ],
  },
  {
    date: "November 2025",
    title: "Project Inception & Core Canvas",
    description: "The beginning of Flowstry. Building the fundamental canvas engine.",
    features: [
      "Rich text formatting & styling",
      "Basic shapes & SVG support",
      "Connector engine (arrows & lines)",
      "Zoom, pan, and canvas navigation",
      "Shape styling (fill, stroke, opacity)",
      "Export to Image",
      "Save to local storage",
      "Undo/Redo history",
    ],
  },
];

export default function ChangelogPage() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "/";

  return (
    <main className="relative min-h-screen bg-[#0f0f0f] text-neutral-200">
       <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,#2b2b2b,transparent_55%)]" />
       <div className="absolute inset-0 -z-10 dot-grid opacity-60" />

      <StickyHeader appUrl={appUrl} />

      <section className="mx-auto max-w-4xl px-6 py-24">
        <div className="mb-16 text-center">
          <h1 className="text-4xl font-bold text-white md:text-5xl">Changelog</h1>
          <p className="mt-4 text-lg text-neutral-400">
            A timeline of Flowstry's journey from inception to cloud workspaces.
          </p>
        </div>

        <div className="space-y-12">
          {releases.map((release, index) => (
            <div key={index} className="relative border-l border-white/10 pl-8 md:pl-12">
              <span className="absolute -left-[5px] top-2 h-2.5 w-2.5 rounded-full bg-[var(--primary)] shadow-[0_0_10px_var(--primary)]" />
              
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-4">
                <span className="text-sm font-semibold uppercase tracking-wider text-[var(--primary)]">
                  {release.date}
                </span>
                <h2 className="text-2xl font-semibold text-white">{release.title}</h2>
              </div>
              
              <p className="mt-3 text-neutral-400">{release.description}</p>
              
              <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                {release.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/5 p-3 text-sm text-neutral-300 transition hover:bg-white/10">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-white/40" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <Footer />
    </main>
  );
}
