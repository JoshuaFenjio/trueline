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

  // ---- 2026 expansion ------------------------------------------------------
  // AI / ML
  "Aleph Alpha": "AI", Poolside: "AI", "H Company": "AI", Photoroom: "AI",
  "Hugging Face": "AI", LightOn: "AI", Kyutai: "AI", "Black Forest Labs": "AI",
  Parloa: "AI", Langdock: "AI", DeepJudge: "AI", Giskard: "AI", Dust: "AI",
  Finegrain: "AI", Gladia: "AI", LeChat: "AI", Unbabel: "AI", "Silo AI": "AI",
  // Fintech
  Zilch: "Fintech", Curve: "Fintech", Cleo: "Fintech", Plum: "Fintech",
  Moneybox: "Fintech", Freetrade: "Fintech", PrimaryBid: "Fintech", Codat: "Fintech",
  Yapily: "Fintech", TrueLayer: "Fintech", Volt: "Fintech", "Vivid Money": "Fintech",
  Solaris: "Fintech", Raisin: "Fintech", "Scalable Capital": "Fintech", Bitpanda: "Fintech",
  "Ramp Network": "Fintech", Payhawk: "Fintech", Wamo: "Fintech", Finom: "Fintech",
  Bunq: "Fintech", Alma: "Fintech", Lydia: "Fintech", Swan: "Fintech",
  Defacto: "Fintech", "Memo Bank": "Fintech",
  // Devtools / infra
  Sentry: "Devtools", Checkly: "Devtools", Appsmith: "Devtools", Directus: "Devtools",
  Strapi: "Devtools", Meilisearch: "Devtools", Qovery: "Devtools", Koyeb: "Devtools",
  Scaleway: "Devtools", OVHcloud: "Devtools", Upstash: "Devtools", Weaviate: "Devtools",
  Qdrant: "Devtools", Neo4j: "Devtools", Camunda: "Devtools", Cypress: "Devtools",
  Storyblok: "Devtools", Hygraph: "Devtools", Crowdin: "Devtools", Localazy: "Devtools",
  // SaaS / B2B
  Pigment: "SaaS", Payflows: "SaaS", "360Learning": "SaaS", Yousign: "SaaS",
  Agicap: "SaaS", Sellsy: "SaaS", Odoo: "SaaS", Teamleader: "SaaS", Silae: "SaaS",
  Combo: "SaaS", Skello: "SaaS", Shine: "SaaS", Regate: "SaaS", Libeo: "SaaS",
  Upflow: "SaaS", Front: "SaaS", Intercom: "SaaS", Matomo: "SaaS", Klaxoon: "SaaS",
  Slite: "SaaS", Notion: "SaaS", Whereby: "SaaS", Superside: "SaaS", Kognity: "SaaS",
  Mentimeter: "SaaS", Voyado: "SaaS", Dixa: "SaaS", Templafy: "SaaS",
  Supermetrics: "SaaS", Smartly: "SaaS",
  // Consumer / marketplace
  "Too Good To Go": "Consumer", Flink: "Consumer", Getir: "Consumer", Picnic: "Consumer",
  Rohlik: "Consumer", "La Fourche": "Consumer", Ankorstore: "Consumer", Mirakl: "Consumer",
  Veepee: "Consumer", Zalando: "Consumer", "About You": "Consumer", "Otto Group": "Consumer",
  Douglas: "Consumer", Idealo: "Consumer", Spotify: "Consumer", "Epidemic Sound": "Consumer",
  Swappie: "Consumer",
  // Mobility
  Voi: "Mobility", "Tier Mobility": "Mobility", Bolt: "Mobility", Heetch: "Mobility",
  Cabify: "Mobility", "Free Now": "Mobility",
  // Health / bio
  Nabla: "Health", Owkin: "Health", Zava: "Health", "Kaia Health": "Health",
  "Ada Health": "Health", Doctorly: "Health", "Avi Medical": "Health", Patient21: "Health",
  Medwing: "Health", "Heartbeat Medical": "Health",
  // Security
  Lakera: "Security", Tines: "Security", Detectify: "Security", "Truffle Security": "Security",
  Hoxhunt: "Security", CybelAngel: "Security", Gatewatcher: "Security",
};

export function sectorOf(company: string): Sector {
  return SECTOR_BY_COMPANY[company] || "Other";
}
