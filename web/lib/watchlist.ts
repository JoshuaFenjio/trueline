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
  // --- directed sweep: recognisable EMEA scale-ups on enterprise/private ATS ---
  { name: "Revolut", sector: "Fintech", domain: "revolut.com", hqCity: "London", reason: "Hires across EMEA but recruits through a system we don't read, with no public salary ranges." },
  { name: "Klarna", sector: "Fintech", domain: "klarna.com", hqCity: "Stockholm", reason: "No public salary ranges on the boards we track." },
  { name: "Checkout.com", sector: "Fintech", domain: "checkout.com", hqCity: "London", reason: "No public salary ranges on the boards we track." },
  { name: "Starling Bank", sector: "Fintech", domain: "starlingbank.com", hqCity: "London", reason: "No public salary ranges on the boards we track." },
  { name: "Scalable Capital", sector: "Fintech", domain: "scalable.capital", hqCity: "Munich", reason: "No public salary ranges on the boards we track." },
  { name: "Wefox", sector: "Fintech", domain: "wefox.com", hqCity: "Berlin", reason: "No public salary ranges on the boards we track." },
  { name: "Mambu", sector: "Fintech", domain: "mambu.com", hqCity: "Amsterdam", reason: "No public salary ranges on the boards we track." },
  { name: "Backbase", sector: "Fintech", domain: "backbase.com", hqCity: "Amsterdam", reason: "No public salary ranges on the boards we track." },
  { name: "Bitpanda", sector: "Fintech", domain: "bitpanda.com", hqCity: "Vienna", reason: "No public salary ranges on the boards we track." },
  { name: "Wiz", sector: "Security", domain: "wiz.io", hqCity: "Tel Aviv (EMEA hubs)", reason: "Hires across EMEA but recruits through a system we don't read." },
  { name: "Darktrace", sector: "Security", domain: "darktrace.com", hqCity: "Cambridge", reason: "No public salary ranges on the boards we track." },
  { name: "Snyk", sector: "Security", domain: "snyk.io", hqCity: "London", reason: "No public salary ranges on the boards we track." },
  { name: "Veriff", sector: "Security", domain: "veriff.com", hqCity: "Tallinn", reason: "No public salary ranges on the boards we track." },
  { name: "Monday.com", sector: "SaaS", domain: "monday.com", hqCity: "Tel Aviv", reason: "No public salary ranges on the boards we track." },
  { name: "Deel", sector: "SaaS", domain: "deel.com", hqCity: "Remote-first (EMEA hubs)", reason: "Recruits through a system we don't read; no public salary ranges." },
  { name: "OutSystems", sector: "Devtools", domain: "outsystems.com", hqCity: "Lisbon", reason: "No public salary ranges on the boards we track." },
  { name: "Talkdesk", sector: "SaaS", domain: "talkdesk.com", hqCity: "Lisbon", reason: "No public salary ranges on the boards we track." },
  { name: "Odoo", sector: "SaaS", domain: "odoo.com", hqCity: "Louvain-la-Neuve", reason: "No public salary ranges on the boards we track." },
  { name: "TravelPerk", sector: "SaaS", domain: "travelperk.com", hqCity: "Barcelona", reason: "No public salary ranges on the boards we track." },
  { name: "Factorial", sector: "SaaS", domain: "factorialhr.com", hqCity: "Barcelona", reason: "No public salary ranges on the boards we track." },
  { name: "GoStudent", sector: "SaaS", domain: "gostudent.org", hqCity: "Vienna", reason: "No public salary ranges on the boards we track." },
  { name: "WeTransfer", sector: "Consumer", domain: "wetransfer.com", hqCity: "Amsterdam", reason: "No public salary ranges on the boards we track." },
  { name: "ManoMano", sector: "Consumer", domain: "manomano.com", hqCity: "Paris", reason: "No public salary ranges on the boards we track." },
  { name: "BlaBlaCar", sector: "Mobility", domain: "blablacar.com", hqCity: "Paris", reason: "No public salary ranges on the boards we track." },
  { name: "On", sector: "Consumer", domain: "on.com", hqCity: "Zurich", reason: "No public salary ranges on the boards we track." },
  { name: "Octopus Energy", sector: "Consumer", domain: "octopus.energy", hqCity: "London", reason: "No public salary ranges on the boards we track." },
  { name: "Bending Spoons", sector: "Consumer", domain: "bendingspoons.com", hqCity: "Milan", reason: "No public salary ranges on the boards we track." },
  { name: "Booksy", sector: "Consumer", domain: "booksy.com", hqCity: "Warsaw", reason: "No public salary ranges on the boards we track." },
  { name: "Feedzai", sector: "AI", domain: "feedzai.com", hqCity: "Coimbra", reason: "No public salary ranges on the boards we track." },
  { name: "Sword Health", sector: "Health", domain: "swordhealth.com", hqCity: "Porto", reason: "No public salary ranges on the boards we track." },
];

export function watchlistBySlug(slug: string): WatchEntry | null {
  return WATCHLIST.find((w) => slugify(w.name) === slug) || null;
}
