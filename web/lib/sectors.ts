// Sector assignment for companies. Pay Score is a percentile of a company's
// median advertised base vs its SECTOR peers, so these groupings matter.
// Anything not listed falls back to "Other".

export const SECTOR_BY_COMPANY: Record<string, string> = {
  // Fintech / payments / regtech
  Adyen: "Fintech", Monzo: "Fintech", Wise: "Fintech", N26: "Fintech",
  GoCardless: "Fintech", Qonto: "Fintech", Pleo: "Fintech", SumUp: "Fintech",
  Mollie: "Fintech", "Trade Republic": "Fintech", Pennylane: "Fintech",
  Tide: "Fintech", Form3: "Fintech", Griffin: "Fintech", Lunar: "Fintech",
  Zopa: "Fintech", Marshmallow: "Fintech", Ledger: "Fintech",
  ComplyAdvantage: "Fintech",

  // AI / ML
  "Mistral AI": "AI/ML", ElevenLabs: "AI/ML", Synthesia: "AI/ML",
  Wayve: "AI/ML", DeepL: "AI/ML", PolyAI: "AI/ML", "Stability AI": "AI/ML",
  Faculty: "AI/ML", Speechmatics: "AI/ML", Helsing: "AI/ML",
  Graphcore: "AI/ML", Peak: "AI/ML",

  // Developer tools / infra
  GitLab: "Dev Tools", "Grafana Labs": "Dev Tools", PostHog: "Dev Tools",
  n8n: "Dev Tools", Tinybird: "Dev Tools", Algolia: "Dev Tools",

  // Data & analytics
  Celonis: "Data & Analytics", Dataiku: "Data & Analytics",
  Collibra: "Data & Analytics", Quantexa: "Data & Analytics",
  Matillion: "Data & Analytics", Contentsquare: "Data & Analytics",
  Cognite: "Data & Analytics",

  // Marketplaces / commerce / travel
  "Back Market": "Marketplace", "Vestiaire Collective": "Marketplace",
  Farfetch: "Marketplace", Sorare: "Marketplace", Moonpig: "Marketplace",
  Omio: "Marketplace", GetYourGuide: "Marketplace", Skyscanner: "Marketplace",
  Blablacar: "Marketplace",

  // Food & delivery
  "Delivery Hero": "Food & Delivery", Deliveroo: "Food & Delivery",
  Wolt: "Food & Delivery", HelloFresh: "Food & Delivery", Gousto: "Food & Delivery",

  // Health
  Doctolib: "Health", Alan: "Health", "Flo Health": "Health", Oura: "Health",

  // HR & people ops
  Personio: "HR & People", HiBob: "HR & People", Remote: "HR & People",
  Oyster: "HR & People", Leapsome: "HR & People", Humaans: "HR & People",
  Beamery: "HR & People", PayFit: "HR & People",

  // Horizontal SaaS
  Contentful: "SaaS", Typeform: "SaaS", Juro: "SaaS", Pipedrive: "SaaS",
  Trustpilot: "SaaS", Aircall: "SaaS", Truecaller: "SaaS",
};

export function sectorOf(company: string): string {
  return SECTOR_BY_COMPANY[company] || "Other";
}
