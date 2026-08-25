import type { Metadata } from "next";
import { Schibsted_Grotesk } from "next/font/google";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { NavBar, Footer } from "@/components/Chrome";
import { SITE_URL } from "@/lib/site";

const schibsted = Schibsted_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "700", "800"],
  style: ["normal", "italic"],
  variable: "--font-schibsted",
  display: "swap",
});

// metadataBase resolves every relative OG/twitter image to an absolute URL, so
// it has to be the real public origin — see lib/site.
const SITE = SITE_URL;

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "Trueline: know what Europe actually pays you",
    template: "%s · Trueline",
  },
  description:
    "Real salary benchmarks from public job postings across Europe, the Middle East and Africa. Search by role, level and city. Advertised base pay, honest sample sizes.",
  openGraph: {
    type: "website",
    siteName: "Trueline",
    title: "Trueline: know what Europe actually pays you",
    description: "Real EMEA salary benchmarks from live job postings. Base pay, by role, level and city.",
    url: SITE,
  },
  twitter: {
    card: "summary_large_image",
    title: "Trueline: know what Europe actually pays you",
    description: "Real EMEA salary benchmarks from live job postings.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${schibsted.variable} ${GeistMono.variable}`}>
      <body className="font-sans">
        <NavBar />
        <main className="container-page">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
