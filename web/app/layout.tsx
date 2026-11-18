import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { NavBar, Footer } from "@/components/Chrome";
import { SITE_URL } from "@/lib/site";

// Self-hosted (see app/fonts/README.md): next/font/google broke the build.
// Same Schibsted Grotesk files Google serves; one variable file per style
// covers the 400/500/700/800 weights the site uses.
const schibsted = localFont({
  src: [
    { path: "./fonts/SchibstedGrotesk-latin.woff2", weight: "400 900", style: "normal" },
    { path: "./fonts/SchibstedGrotesk-Italic-latin.woff2", weight: "400 900", style: "italic" },
  ],
  variable: "--font-schibsted",
  display: "swap",
});

// metadataBase resolves every relative OG/twitter image to an absolute URL, so
// it has to be the real public origin — see lib/site.
const SITE = SITE_URL;

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "SalaryRadar: know what Europe actually pays you",
    template: "%s · SalaryRadar",
  },
  description:
    "Real salary benchmarks from public job postings across Europe, the Middle East and Africa. Search by role, level and city. Advertised base pay, honest sample sizes.",
  openGraph: {
    type: "website",
    siteName: "SalaryRadar",
    title: "SalaryRadar: know what Europe actually pays you",
    description: "Real EMEA salary benchmarks from live job postings. Base pay, by role, level and city.",
    url: SITE,
  },
  twitter: {
    card: "summary_large_image",
    title: "SalaryRadar: know what Europe actually pays you",
    description: "Real EMEA salary benchmarks from live job postings.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={schibsted.variable}>
      <body className="font-sans">
        <NavBar />
        <main className="container-page">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
