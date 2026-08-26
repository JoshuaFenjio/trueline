// Parse a broad free-text query ("software engineer berlin", "ml zurich",
// "sales london", "monzo") into a role / city / company route. Pure so it can
// run on the client and be unit-tested.

export interface ParseOpts {
  roles: string[]; // canonical role_family values present in the data
  cities: { label: string }[]; // canonical city labels
  companies: { name: string; slug: string }[];
}
export interface Parsed {
  role?: string;
  city?: string;
  companySlug?: string;
}

// keyword (word-boundary, lowercased) -> canonical role_family. Longer phrases
// first so "data scientist" wins over "data".
const SYNONYMS: [string, string][] = [
  // Most specific / longest phrases first so they win over the generic catches.
  ["engineering manager", "Engineering Manager"], ["eng manager", "Engineering Manager"],
  ["product marketing", "Product Marketing"],
  ["machine learning", "ML/AI Engineer"], ["ml engineer", "ML/AI Engineer"],
  ["ai engineer", "ML/AI Engineer"], ["ml/ai", "ML/AI Engineer"],
  ["research scientist", "Research Scientist"], ["applied scientist", "Research Scientist"],
  ["data scientist", "Data Scientist"], ["data science", "Data Scientist"],
  ["data engineer", "Data Engineer"], ["analytics engineer", "Data Engineer"],
  ["data analyst", "Data Analyst"], ["business analyst", "Data Analyst"],
  ["security operations", "SecOps"], ["secops", "SecOps"],
  ["security engineer", "Security Engineer"],
  ["solutions engineer", "Solutions Engineer"], ["solution engineer", "Solutions Engineer"],
  ["sales engineer", "Solutions Engineer"], ["presales", "Solutions Engineer"], ["pre-sales", "Solutions Engineer"],
  ["software engineer", "Software Engineer"], ["full stack", "Software Engineer"], ["fullstack", "Software Engineer"],
  ["backend", "Backend"], ["back end", "Backend"], ["frontend", "Frontend"], ["front end", "Frontend"],
  ["mobile", "Mobile"], ["ios", "Mobile"], ["android", "Mobile"],
  ["devops", "DevOps/Platform"], ["sre", "DevOps/Platform"], ["platform", "DevOps/Platform"], ["infrastructure", "DevOps/Platform"],
  ["hardware", "Hardware/Embedded"], ["embedded", "Hardware/Embedded"], ["firmware", "Hardware/Embedded"],
  ["qa", "QA/Test"], ["test", "QA/Test"],
  ["product manager", "Product Manager"], ["designer", "Designer"], ["design", "Designer"],
  // Go-to-market
  ["account executive", "Account Executive"], ["account manager", "Account Manager"],
  ["sales development", "SDR/BDR"], ["sdr", "SDR/BDR"], ["bdr", "SDR/BDR"],
  ["business development", "BizDev/Partnerships"], ["partnerships", "BizDev/Partnerships"], ["partnership", "BizDev/Partnerships"],
  ["performance marketing", "Performance Marketing"], ["paid", "Performance Marketing"], ["seo", "Performance Marketing"],
  ["content", "Content"], ["copywriter", "Content"],
  ["brand", "Brand"], ["communications", "Brand"], ["events", "Brand"],
  ["marketing", "Marketing"], ["growth", "Marketing"],
  ["customer success", "Customer Success"], ["customer support", "Support"], ["support", "Support"],
  // Operations
  ["business operations", "BizOps"], ["bizops", "BizOps"], ["revops", "BizOps"], ["revenue operations", "BizOps"],
  ["strategy", "Strategy"], ["chief of staff", "Strategy"],
  ["consultant", "Consultant"], ["consulting", "Consultant"],
  ["executive assistant", "Office/EA"], ["office manager", "Office/EA"],
  ["operations", "Operations"],
  // Finance
  ["payroll", "Payroll"], ["fp&a", "FP&A"], ["financial planning", "FP&A"],
  ["accountant", "Accounting"], ["accounting", "Accounting"], ["finance", "Finance"],
  // Legal / people
  ["compliance", "Compliance"], ["regulatory", "Compliance"], ["risk", "Compliance"],
  ["legal", "Legal"], ["counsel", "Legal"],
  ["recruiter", "Recruiter/TA"], ["recruiting", "Recruiter/TA"], ["talent acquisition", "Recruiter/TA"], ["talent", "Recruiter/TA"],
  ["people", "People/HR"], ["hr", "People/HR"],
  // Generic single-word fallbacks last.
  ["security", "Security Engineer"], ["product", "Product Manager"],
  ["sales", "Account Executive"], ["ml", "ML/AI Engineer"], ["ai", "ML/AI Engineer"],
  ["swe", "Software Engineer"], ["engineer", "Software Engineer"],
];

export function parseQuery(raw: string, opts: ParseOpts): Parsed {
  const q = raw.toLowerCase().trim().replace(/\s+/g, " ");
  if (!q) return {};

  // Exact company name -> company page.
  const exact = opts.companies.find((c) => c.name.toLowerCase() === q);
  if (exact) return { companySlug: exact.slug };

  // City: longest canonical city name found in the query.
  let city: string | undefined;
  let cityMatch = "";
  for (const c of opts.cities) {
    const cl = c.label.toLowerCase();
    if (cl.length < 3) continue;
    const re = new RegExp(`(^|\\s)${cl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|\\s)`);
    if (re.test(q) && cl.length > cityMatch.length) { city = c.label; cityMatch = cl; }
  }
  const rest = cityMatch ? q.replace(cityMatch, " ").replace(/\s+/g, " ").trim() : q;

  // Role via synonyms on the remaining words.
  let role: string | undefined;
  for (const [kw, rf] of SYNONYMS) {
    const re = new RegExp(`(^|\\s)${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|\\s)`);
    if (re.test(rest) && opts.roles.includes(rf)) { role = rf; break; }
  }

  // Nothing role/city and it looks like a company name -> company page.
  if (!role && !city) {
    const partial = opts.companies.find(
      (c) => c.name.toLowerCase().startsWith(q) || q.startsWith(c.name.toLowerCase())
    );
    if (partial) return { companySlug: partial.slug };
  }

  return { role, city };
}

// Build the destination href from a parse result.
export function parsedHref(p: Parsed): string {
  if (p.companySlug) return `/companies/${p.companySlug}`;
  const params = new URLSearchParams();
  if (p.role) params.set("role", p.role);
  if (p.city) params.set("city", p.city);
  const qs = params.toString();
  return qs ? `/?${qs}#results` : "/";
}
