// WATCHLIST — famous companies with EMEA presence that don't publish salaries
// on the public applicant-tracking systems we read. They get a company page so
// the name is discoverable, but the page is honest: postings = 0, transparency
// = unknown, no invented pay. If one later exposes a public board and appears
// in the scraped board, the real page takes over (board wins over watchlist).
import { slugify } from "@/lib/format";

export interface WatchEntry {
  name: string;
  sector: string;
  domain: string;   // for the logo
  hqCity?: string;
  reason: string;   // why we have no pay data
}

export const WATCHLIST: WatchEntry[] = [
  { name: "Uber", sector: "Mobility", domain: "uber.com", hqCity: "Amsterdam (EMEA HQ)", reason: "Hires across EMEA but posts through an enterprise system we don't read, and doesn't publish pay ranges." },
  { name: "Airbnb", sector: "Consumer", domain: "airbnb.com", hqCity: "Dublin (EMEA HQ)", reason: "No public salary ranges on the boards we track." },
  { name: "Netflix", sector: "Consumer", domain: "netflix.com", hqCity: "Amsterdam (EMEA HQ)", reason: "Publishes roles but not structured pay on a board we read." },
  { name: "Amazon", sector: "Consumer", domain: "amazon.com", hqCity: "Luxembourg (EMEA HQ)", reason: "Hires at huge scale in EMEA but through an enterprise ATS without public pay." },
  { name: "Google", sector: "AI", domain: "google.com", hqCity: "Dublin (EMEA HQ)", reason: "No public salary ranges on the boards we track." },
  { name: "Microsoft", sector: "SaaS", domain: "microsoft.com", hqCity: "Dublin (EMEA HQ)", reason: "Enterprise ATS, no public pay ranges." },
  { name: "Apple", sector: "Consumer", domain: "apple.com", hqCity: "Cork (EMEA HQ)", reason: "No public salary ranges on the boards we track." },
  { name: "Meta", sector: "AI", domain: "meta.com", hqCity: "London (EMEA hub)", reason: "Enterprise ATS, no public pay ranges." },
  { name: "TikTok", sector: "Consumer", domain: "tiktok.com", hqCity: "London / Dublin", reason: "Large EMEA hiring but no public pay on a board we read." },
  { name: "PayPal", sector: "Fintech", domain: "paypal.com", hqCity: "Dublin (EMEA HQ)", reason: "Enterprise ATS, no public pay ranges." },
  { name: "SAP", sector: "SaaS", domain: "sap.com", hqCity: "Walldorf", reason: "SuccessFactors ATS, no public salary ranges we can read." },
  { name: "Siemens", sector: "Other", domain: "siemens.com", hqCity: "Munich", reason: "Enterprise ATS, no public pay ranges." },
  { name: "Bosch", sector: "Other", domain: "bosch.com", hqCity: "Stuttgart", reason: "Enterprise ATS, no public pay ranges." },
  { name: "Philips", sector: "Health", domain: "philips.com", hqCity: "Amsterdam", reason: "Enterprise ATS, no public pay ranges." },
  { name: "Adidas", sector: "Consumer", domain: "adidas.com", hqCity: "Herzogenaurach", reason: "No public salary ranges on the boards we track." },
  { name: "IKEA", sector: "Consumer", domain: "ikea.com", hqCity: "Leiden / Delft", reason: "Enterprise ATS, no public pay ranges." },
  { name: "Ryanair", sector: "Mobility", domain: "ryanair.com", hqCity: "Dublin", reason: "No public salary ranges on the boards we track." },
  { name: "Booking.com", sector: "Consumer", domain: "booking.com", hqCity: "Amsterdam", reason: "Large Amsterdam hiring but no public pay ranges on a board we read." },
  { name: "Salesforce", sector: "SaaS", domain: "salesforce.com", hqCity: "London / Dublin", reason: "Enterprise ATS, no public pay ranges." },
  { name: "Oracle", sector: "SaaS", domain: "oracle.com", hqCity: "Dublin", reason: "Enterprise ATS, no public pay ranges." },
  { name: "IBM", sector: "SaaS", domain: "ibm.com", hqCity: "Dublin (EMEA HQ)", reason: "Enterprise ATS, no public pay ranges." },
  { name: "Nvidia", sector: "AI", domain: "nvidia.com", hqCity: "Multiple EMEA", reason: "No public salary ranges on the boards we track." },
  { name: "Cisco", sector: "SaaS", domain: "cisco.com", hqCity: "Multiple EMEA", reason: "Enterprise ATS, no public pay ranges." },
  { name: "Zoom", sector: "SaaS", domain: "zoom.us", hqCity: "Amsterdam / London", reason: "No public salary ranges on the boards we track." },
  { name: "eBay", sector: "Consumer", domain: "ebay.com", hqCity: "Berlin / Dublin", reason: "No public salary ranges on the boards we track." },
  { name: "Rakuten", sector: "Consumer", domain: "rakuten.com", hqCity: "Paris / Multiple", reason: "No public salary ranges on the boards we track." },
  { name: "Ubisoft", sector: "Consumer", domain: "ubisoft.com", hqCity: "Paris / Montpellier", reason: "No public salary ranges on the boards we track." },
  { name: "Expedia", sector: "Consumer", domain: "expedia.com", hqCity: "London", reason: "No public salary ranges on the boards we track." },
];

export function watchlistBySlug(slug: string): WatchEntry | null {
  return WATCHLIST.find((w) => slugify(w.name) === slug) || null;
}
