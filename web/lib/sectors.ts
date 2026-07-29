// Sector taxonomy — every company maps to exactly one of these nine.
export const SECTORS = [
  "AI", "Fintech", "Devtools", "SaaS", "Consumer", "Health", "Mobility", "Security", "Other",
] as const;
export type Sector = (typeof SECTORS)[number];

const SECTOR_BY_COMPANY: Record<string, Sector> = {
  // AI / ML
  "Mistral AI": "AI", ElevenLabs: "AI", Synthesia: "AI", Wayve: "AI", DeepL: "AI",
  Helsing: "AI", Graphcore: "AI", Dataiku: "AI", PolyAI: "AI", "Stability AI": "AI",
  Faculty: "AI", Speechmatics: "AI", Peak: "AI", Cognite: "AI",

  // Fintech / payments / regtech / payroll
  Adyen: "Fintech", Monzo: "Fintech", GoCardless: "Fintech", SumUp: "Fintech",
  Form3: "Fintech", Tide: "Fintech", Lunar: "Fintech", Marshmallow: "Fintech",
  ComplyAdvantage: "Fintech", Ledger: "Fintech", Zopa: "Fintech", Qonto: "Fintech",
  Pleo: "Fintech", Mollie: "Fintech", "Trade Republic": "Fintech", Pennylane: "Fintech",
  Griffin: "Fintech", N26: "Fintech", Wise: "Fintech", PayFit: "Fintech", Swile: "Fintech",

  // Developer tools / infra / data platforms
  GitLab: "Devtools", "Grafana Labs": "Devtools", PostHog: "Devtools", n8n: "Devtools",
  Tinybird: "Devtools", Algolia: "Devtools", Aiven: "Devtools", Matillion: "Devtools",

  // Horizontal / vertical SaaS (incl. HR, analytics, productivity)
  Contentful: "SaaS", Typeform: "SaaS", Juro: "SaaS", Pipedrive: "SaaS",
  Trustpilot: "SaaS", Aircall: "SaaS", Beamery: "SaaS", Leapsome: "SaaS",
  Humaans: "SaaS", Personio: "SaaS", HiBob: "SaaS", Remote: "SaaS", Oyster: "SaaS",
  Miro: "SaaS", Collibra: "SaaS", Celonis: "SaaS", Quantexa: "SaaS", Contentsquare: "SaaS",

  // Consumer / marketplaces / commerce / travel
  HelloFresh: "Consumer", Deliveroo: "Consumer", Wolt: "Consumer", "Back Market": "Consumer",
  "Vestiaire Collective": "Consumer", Farfetch: "Consumer", Sorare: "Consumer",
  Moonpig: "Consumer", GetYourGuide: "Consumer", Skyscanner: "Consumer", Omio: "Consumer",
  Gousto: "Consumer", Depop: "Consumer", Vinted: "Consumer", Truecaller: "Consumer",
  Glovo: "Consumer",

  // Health
  Doctolib: "Health", Alan: "Health", "Flo Health": "Health", Oura: "Health",
  Kry: "Health", Huma: "Health", Cera: "Health",

  // Mobility
  Blablacar: "Mobility",

  // Security
  Snyk: "Security", Darktrace: "Security", Onfido: "Security",
};

export function sectorOf(company: string): Sector {
  return SECTOR_BY_COMPANY[company] || "Other";
}
