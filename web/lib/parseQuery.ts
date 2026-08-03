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
  ["engineering manager", "Engineering Manager"], ["eng manager", "Engineering Manager"],
  ["machine learning", "ML/AI Engineer"], ["ml engineer", "ML/AI Engineer"],
  ["ai engineer", "ML/AI Engineer"], ["ml/ai", "ML/AI Engineer"],
  ["data scientist", "Data Scientist"], ["data science", "Data Scientist"],
  ["data engineer", "Data Engineer"], ["analytics engineer", "Data Engineer"],
  ["data analyst", "Data Analyst"], ["business analyst", "Data Analyst"],
  ["account executive", "Sales/AE"], ["customer success", "Customer Success"],
  ["product manager", "Product Manager"], ["security engineer", "Security Engineer"],
  ["software engineer", "Software Engineer"], ["full stack", "Software Engineer"],
  ["fullstack", "Software Engineer"], ["backend", "Backend"], ["back end", "Backend"],
  ["frontend", "Frontend"], ["front end", "Frontend"], ["mobile", "Mobile"],
  ["ios", "Mobile"], ["android", "Mobile"], ["devops", "DevOps/Platform"],
  ["sre", "DevOps/Platform"], ["platform", "DevOps/Platform"], ["infrastructure", "DevOps/Platform"],
  ["qa", "QA/Test"], ["test", "QA/Test"], ["security", "Security Engineer"],
  ["designer", "Designer"], ["design", "Designer"], ["product", "Product Manager"],
  ["sales", "Sales/AE"], ["marketing", "Marketing"], ["growth", "Marketing"],
  ["finance", "Finance"], ["accountant", "Finance"], ["recruiter", "People/HR"],
  ["people", "People/HR"], ["hr", "People/HR"], ["legal", "Legal"], ["counsel", "Legal"],
  ["operations", "Operations"], ["ml", "ML/AI Engineer"], ["ai", "ML/AI Engineer"],
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
