import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

import Script from "next/script";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const siteUrl = "https://app.flowstry.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Flowstry",
    template: "%s | Flowstry",
  },
  description:
    "Flowstry is a visual system design tool that helps you design architectures with flow and structure—perfect for modern system thinkers.",
  keywords: [
    "system design",
    "software design",
    "system architecture",
    "visual system design",
    "architecture diagram",
    "software architecture",
    "flow diagram",
    "microservices design",
    "backend architecture",
    "data flow",
    "infrastructure planning",
    "technical documentation",
    "system thinking",
    "canvas",
    "diagramming tool",
    "design tool",
    "flowchart",
    "structured design",
  ],
  authors: [{ name: "Flowstry" }],
  creator: "Flowstry",
  publisher: "Flowstry",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png" },
    ],
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "Flowstry",
    title: "Flowstry — Design Systems Where Flow Meets Structure",
    description:
      "Design system architectures with clarity using Flowstry. A visual canvas where flow meets structure for complex systems.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Design systems where flow meets structure.",
    description:
      "Flowstry helps teams design systems with clarity, flow, and structure.",
    creator: "@FlowstryOffical",
  },
  alternates: {
    canonical: siteUrl,
  },
  category: "Technology",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Google Analytics */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-8YCL2RJ3N7"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-8YCL2RJ3N7');
          `}
        </Script>
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}

