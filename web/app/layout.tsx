import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Instrument_Serif } from "next/font/google";
import "./globals.css";
import { NavBar, Footer } from "@/components/Chrome";

const instrument = Instrument_Serif({
  subsets: ["latin"], weight: "400", style: "italic", variable: "--font-instrument", display: "swap",
});

// Prefer an explicit site URL, else the Vercel deployment URL, else a placeholder.
// This makes OG image URLs absolute against the real host so LinkedIn can fetch them.
const SITE =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://trueline.vercel.app");

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "Trueline — Know what Europe actually pays you",
    template: "%s · Trueline",
  },
  description:
    "Real salary benchmarks from public job postings across Europe, the Middle East and Africa. Search by role, level and city. Advertised base pay, honest sample sizes.",
  openGraph: {
    type: "website",
    siteName: "Trueline",
    title: "Trueline — Know what Europe actually pays you",
    description: "Real EMEA salary benchmarks from live job postings. Base pay, by role, level and city.",
    url: SITE,
  },
  twitter: {
    card: "summary_large_image",
    title: "Trueline — Know what Europe actually pays you",
    description: "Real EMEA salary benchmarks from live job postings.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} ${instrument.variable}`}>
      <body className="font-sans">
        <NavBar />
        <main className="mx-auto max-w-6xl px-5">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
