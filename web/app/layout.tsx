import type { Metadata } from "next";
import { Schibsted_Grotesk } from "next/font/google";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { NavBar, Footer } from "@/components/Chrome";

const schibsted = Schibsted_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "700", "800"],
  variable: "--font-schibsted",
  display: "swap",
});

// Prefer an explicit site URL, else the Vercel deployment URL, else a placeholder.
// This makes OG image URLs absolute against the real host so LinkedIn can fetch them.
const SITE =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://trueline.vercel.app");

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
