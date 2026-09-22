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
  // One factual line on what the company does. Present only where it is
  // uncontroversial and checkable in a second; left off otherwise. No funding
  // figures, no headcounts, no people facts.
  description?: string;
}

export const WATCHLIST: WatchEntry[] = [
  { name: "Uber", sector: "Mobility", domain: "uber.com", hqCity: "Amsterdam (EMEA HQ)", reason: "Hires across EMEA but posts through an enterprise system we don't read, and doesn't publish pay ranges.", description: "Ride-hailing and delivery platform." },
  { name: "Airbnb", sector: "Consumer", domain: "airbnb.com", hqCity: "Dublin (EMEA HQ)", reason: "No public salary ranges on the boards we track.", description: "Marketplace for short-term stays." },
  { name: "Netflix", sector: "Consumer", domain: "netflix.com", hqCity: "Amsterdam (EMEA HQ)", reason: "Publishes roles but not structured pay on a board we read.", description: "Subscription streaming service." },
  { name: "Amazon", sector: "Consumer", domain: "amazon.com", hqCity: "Luxembourg (EMEA HQ)", reason: "Hires at huge scale in EMEA but through an enterprise ATS without public pay.", description: "Online retail and cloud computing." },
  { name: "Google", sector: "AI", domain: "google.com", hqCity: "Dublin (EMEA HQ)", reason: "No public salary ranges on the boards we track.", description: "Search, advertising and cloud services." },
  { name: "Microsoft", sector: "SaaS", domain: "microsoft.com", hqCity: "Dublin (EMEA HQ)", reason: "Enterprise ATS, no public pay ranges.", description: "Software, cloud and devices." },
  { name: "Apple", sector: "Consumer", domain: "apple.com", hqCity: "Cork (EMEA HQ)", reason: "No public salary ranges on the boards we track.", description: "Consumer devices, software and services." },
  { name: "Meta", sector: "AI", domain: "meta.com", hqCity: "London (EMEA hub)", reason: "Enterprise ATS, no public pay ranges.", description: "Social networking and advertising." },
  { name: "TikTok", sector: "Consumer", domain: "tiktok.com", hqCity: "London / Dublin", reason: "Large EMEA hiring but no public pay on a board we read.", description: "Short-form video platform." },
  { name: "PayPal", sector: "Fintech", domain: "paypal.com", hqCity: "Dublin (EMEA HQ)", reason: "Enterprise ATS, no public pay ranges.", description: "Online payments and money transfer." },
  { name: "SAP", sector: "SaaS", domain: "sap.com", hqCity: "Walldorf", reason: "SuccessFactors ATS, no public salary ranges we can read.", description: "Enterprise resource-planning software." },
  { name: "Siemens", sector: "Other", domain: "siemens.com", hqCity: "Munich", reason: "Enterprise ATS, no public pay ranges.", description: "Industrial automation, energy and mobility." },
  { name: "Bosch", sector: "Other", domain: "bosch.com", hqCity: "Stuttgart", reason: "Enterprise ATS, no public pay ranges.", description: "Automotive components, tools and appliances." },
  { name: "Philips", sector: "Health", domain: "philips.com", hqCity: "Amsterdam", reason: "Enterprise ATS, no public pay ranges.", description: "Health technology and medical devices." },
  { name: "Adidas", sector: "Consumer", domain: "adidas.com", hqCity: "Herzogenaurach", reason: "No public salary ranges on the boards we track.", description: "Sportswear and footwear." },
  { name: "IKEA", sector: "Consumer", domain: "ikea.com", hqCity: "Leiden / Delft", reason: "Enterprise ATS, no public pay ranges.", description: "Flat-pack furniture and home retail." },
  { name: "Ryanair", sector: "Mobility", domain: "ryanair.com", hqCity: "Dublin", reason: "No public salary ranges on the boards we track.", description: "Low-cost European airline." },
  { name: "Booking.com", sector: "Consumer", domain: "booking.com", hqCity: "Amsterdam", reason: "Large Amsterdam hiring but no public pay ranges on a board we read.", description: "Online travel and accommodation booking." },
  { name: "Salesforce", sector: "SaaS", domain: "salesforce.com", hqCity: "London / Dublin", reason: "Enterprise ATS, no public pay ranges.", description: "Cloud CRM and business software." },
  { name: "Oracle", sector: "SaaS", domain: "oracle.com", hqCity: "Dublin", reason: "Enterprise ATS, no public pay ranges.", description: "Databases, enterprise software and cloud." },
  { name: "IBM", sector: "SaaS", domain: "ibm.com", hqCity: "Dublin (EMEA HQ)", reason: "Enterprise ATS, no public pay ranges.", description: "Enterprise IT, consulting and research." },
  { name: "Nvidia", sector: "AI", domain: "nvidia.com", hqCity: "Multiple EMEA", reason: "No public salary ranges on the boards we track.", description: "GPUs and AI computing hardware." },
  { name: "Cisco", sector: "SaaS", domain: "cisco.com", hqCity: "Multiple EMEA", reason: "Enterprise ATS, no public pay ranges.", description: "Networking hardware and security." },
  { name: "Zoom", sector: "SaaS", domain: "zoom.us", hqCity: "Amsterdam / London", reason: "No public salary ranges on the boards we track.", description: "Video conferencing and communications." },
  { name: "eBay", sector: "Consumer", domain: "ebay.com", hqCity: "Berlin / Dublin", reason: "No public salary ranges on the boards we track.", description: "Online marketplace for goods." },
  { name: "Rakuten", sector: "Consumer", domain: "rakuten.com", hqCity: "Paris / Multiple", reason: "No public salary ranges on the boards we track.", description: "E-commerce, fintech and digital services." },
  { name: "Ubisoft", sector: "Consumer", domain: "ubisoft.com", hqCity: "Paris / Montpellier", reason: "No public salary ranges on the boards we track.", description: "Video game development and publishing." },
  { name: "Expedia", sector: "Consumer", domain: "expedia.com", hqCity: "London", reason: "No public salary ranges on the boards we track.", description: "Online travel booking." },
  // --- directed sweep: recognisable EMEA scale-ups on enterprise/private ATS ---
  { name: "Revolut", sector: "Fintech", domain: "revolut.com", hqCity: "London", reason: "Hires across EMEA but recruits through a system we don't read, with no public salary ranges.", description: "App-based banking and money transfer." },
  { name: "Klarna", sector: "Fintech", domain: "klarna.com", hqCity: "Stockholm", reason: "No public salary ranges on the boards we track.", description: "Buy-now-pay-later and payments." },
  { name: "Checkout.com", sector: "Fintech", domain: "checkout.com", hqCity: "London", reason: "No public salary ranges on the boards we track.", description: "Online payment processing for merchants." },
  { name: "Starling Bank", sector: "Fintech", domain: "starlingbank.com", hqCity: "London", reason: "No public salary ranges on the boards we track.", description: "App-based UK bank." },
  { name: "Scalable Capital", sector: "Fintech", domain: "scalable.capital", hqCity: "Munich", reason: "No public salary ranges on the boards we track.", description: "Digital investing and brokerage." },
  { name: "Wefox", sector: "Fintech", domain: "wefox.com", hqCity: "Berlin", reason: "No public salary ranges on the boards we track.", description: "Digital insurance distribution." },
  { name: "Mambu", sector: "Fintech", domain: "mambu.com", hqCity: "Amsterdam", reason: "No public salary ranges on the boards we track.", description: "Cloud core-banking platform." },
  { name: "Backbase", sector: "Fintech", domain: "backbase.com", hqCity: "Amsterdam", reason: "No public salary ranges on the boards we track.", description: "Digital banking engagement software." },
  { name: "Bitpanda", sector: "Fintech", domain: "bitpanda.com", hqCity: "Vienna", reason: "No public salary ranges on the boards we track.", description: "Retail investing and crypto brokerage." },
  { name: "Wiz", sector: "Security", domain: "wiz.io", hqCity: "Tel Aviv (EMEA hubs)", reason: "Hires across EMEA but recruits through a system we don't read.", description: "Cloud security posture management." },
  { name: "Darktrace", sector: "Security", domain: "darktrace.com", hqCity: "Cambridge", reason: "No public salary ranges on the boards we track.", description: "AI-based network threat detection." },
  { name: "Snyk", sector: "Security", domain: "snyk.io", hqCity: "London", reason: "No public salary ranges on the boards we track.", description: "Developer-first application security." },
  { name: "Veriff", sector: "Security", domain: "veriff.com", hqCity: "Tallinn", reason: "No public salary ranges on the boards we track.", description: "Identity verification for online services." },
  { name: "Monday.com", sector: "SaaS", domain: "monday.com", hqCity: "Tel Aviv", reason: "No public salary ranges on the boards we track.", description: "Work management and collaboration software." },
  { name: "Deel", sector: "SaaS", domain: "deel.com", hqCity: "Remote-first (EMEA hubs)", reason: "Recruits through a system we don't read; no public salary ranges.", description: "Global payroll, hiring and compliance." },
  { name: "OutSystems", sector: "Devtools", domain: "outsystems.com", hqCity: "Lisbon", reason: "No public salary ranges on the boards we track.", description: "Low-code application development platform." },
  { name: "Talkdesk", sector: "SaaS", domain: "talkdesk.com", hqCity: "Lisbon", reason: "No public salary ranges on the boards we track.", description: "Cloud contact-centre software." },
  { name: "Odoo", sector: "SaaS", domain: "odoo.com", hqCity: "Louvain-la-Neuve", reason: "No public salary ranges on the boards we track.", description: "Open-source business management suite." },
  { name: "TravelPerk", sector: "SaaS", domain: "travelperk.com", hqCity: "Barcelona", reason: "No public salary ranges on the boards we track.", description: "Business travel booking and management." },
  { name: "Factorial", sector: "SaaS", domain: "factorialhr.com", hqCity: "Barcelona", reason: "No public salary ranges on the boards we track.", description: "HR software for small businesses." },
  { name: "GoStudent", sector: "SaaS", domain: "gostudent.org", hqCity: "Vienna", reason: "No public salary ranges on the boards we track.", description: "Online one-to-one tutoring." },
  { name: "WeTransfer", sector: "Consumer", domain: "wetransfer.com", hqCity: "Amsterdam", reason: "No public salary ranges on the boards we track.", description: "File transfer and creative tools." },
  { name: "ManoMano", sector: "Consumer", domain: "manomano.com", hqCity: "Paris", reason: "No public salary ranges on the boards we track.", description: "Online marketplace for DIY and gardening." },
  { name: "BlaBlaCar", sector: "Mobility", domain: "blablacar.com", hqCity: "Paris", reason: "No public salary ranges on the boards we track.", description: "Long-distance carpooling and bus travel." },
  { name: "On", sector: "Consumer", domain: "on.com", hqCity: "Zurich", reason: "No public salary ranges on the boards we track.", description: "Running shoes and sportswear." },
  { name: "Octopus Energy", sector: "Consumer", domain: "octopus.energy", hqCity: "London", reason: "No public salary ranges on the boards we track.", description: "Retail energy supplier and energy technology." },
  { name: "Bending Spoons", sector: "Consumer", domain: "bendingspoons.com", hqCity: "Milan", reason: "No public salary ranges on the boards we track.", description: "Consumer mobile apps." },
  { name: "Booksy", sector: "Consumer", domain: "booksy.com", hqCity: "Warsaw", reason: "No public salary ranges on the boards we track.", description: "Booking software for salons and barbers." },
  { name: "Feedzai", sector: "AI", domain: "feedzai.com", hqCity: "Coimbra", reason: "No public salary ranges on the boards we track.", description: "AI fraud and financial-crime prevention." },
  { name: "Sword Health", sector: "Health", domain: "swordhealth.com", hqCity: "Porto", reason: "No public salary ranges on the boards we track.", description: "Digital physical therapy." },
];

export function watchlistBySlug(slug: string): WatchEntry | null {
  return WATCHLIST.find((w) => slugify(w.name) === slug) || null;
}
