// Display names for role families.
//
// The STORED family key (and therefore every slug and URL) is unchanged — this
// is presentation only. Several stored keys read as a department rather than a
// job ("Backend", "Mobile"), which made role pages look like org charts. Each
// rename below turns the key into something a person would call themselves,
// without implying a seniority the family doesn't carry ("Backend Engineer",
// never "Senior Backend Engineer").
//
// Families that genuinely ARE a group of roles (Operations, Finance, Marketing…)
// keep their name and are marked as groups instead: in search suggestions they
// render with a "— role family" suffix so they can never be mistaken for a job
// title. Everything is derived from these two tables — nothing is hand-written
// per page.

const FAMILY_LABEL: Record<string, string> = {
  Backend: "Backend Engineer",
  Frontend: "Frontend Engineer",
  Mobile: "Mobile Engineer",
  "DevOps/Platform": "DevOps / Platform Engineer",
  "QA/Test": "QA / Test Engineer",
  "Hardware/Embedded": "Hardware / Embedded Engineer",
  "IT/SysAdmin": "IT / Systems Administrator",
  SecOps: "Security Operations Engineer",
  "Recruiter/TA": "Recruiter / Talent Acquisition",
  "Office/EA": "Office Manager / EA",
  "SDR/BDR": "SDR / BDR",
  "Product Marketing": "Product Marketing Manager",
  "Performance Marketing": "Performance Marketing Manager",
  // Groups whose stored key is an abbreviation or reads awkwardly — expanded,
  // but still flagged as a group below.
  BizOps: "Business Operations",
  "People/HR": "People / HR",
  "BizDev/Partnerships": "Business Development & Partnerships",
  "Teaching/Education": "Teaching / Education",
};

// Families that describe a FUNCTION, not a job title. Never rendered as a role.
const GROUP_FAMILIES = new Set<string>([
  "Operations", "Marketing", "Finance", "Accounting", "Legal", "Compliance",
  "Strategy", "Content", "Brand", "Support", "Payroll", "Retail", "Healthcare",
  "Real Estate", "Skilled Trades", "Health & Safety", "BizOps", "People/HR",
  "FP&A", "BizDev/Partnerships", "Customer Success", "Teaching/Education", "Other",
]);

/** Display name for a stored role-family key. Slugs/URLs are unaffected. */
export function familyLabel(family: string | null | undefined): string {
  if (!family) return "";
  return FAMILY_LABEL[family] ?? family;
}

/** True when the family is a function/group rather than a job title. */
export function isGroupFamily(family: string | null | undefined): boolean {
  return !!family && GROUP_FAMILIES.has(family);
}

/**
 * Label for type-ahead / suggestion lists, where a bare "Operations" would read
 * as a job title. Groups get an explicit suffix; real roles are left alone.
 */
export function familySuggestLabel(family: string | null | undefined): string {
  if (!family) return "";
  const label = familyLabel(family);
  return isGroupFamily(family) ? `${label} — role family` : label;
}

// ---------------------------------------------------------------------------
// Broad category per family — the grouping the roles hub browses by, and the
// chip shown on a role page. Presentation only, like the labels above.
// ---------------------------------------------------------------------------
export const FAMILY_CATEGORY: Record<string, string> = {
  "Software Engineer": "Engineering", Backend: "Engineering", Frontend: "Engineering", Mobile: "Engineering",
  "DevOps/Platform": "Engineering", "QA/Test": "Engineering", "Engineering Manager": "Engineering",
  "Security Engineer": "Engineering", SecOps: "Engineering", "Hardware/Embedded": "Engineering",
  "Solutions Engineer": "Engineering", "IT/SysAdmin": "Engineering",
  "Data Engineer": "Data", "Data Scientist": "Data", "Data Analyst": "Data",
  "ML/AI Engineer": "Data", "Research Scientist": "Data",
  "Product Manager": "Product", "Product Marketing": "Product", Designer: "Design",
  "Account Executive": "Go-to-market", "Account Manager": "Go-to-market", "SDR/BDR": "Go-to-market",
  "BizDev/Partnerships": "Go-to-market", Marketing: "Go-to-market", Content: "Go-to-market",
  Brand: "Go-to-market", "Performance Marketing": "Go-to-market", "Customer Success": "Go-to-market",
  Support: "Go-to-market",
  Operations: "Operations", BizOps: "Operations", Strategy: "Operations", Consultant: "Operations",
  "Office/EA": "Operations",
  Finance: "Finance", "FP&A": "Finance", Accounting: "Finance", Payroll: "Finance",
  Legal: "Legal & People", Compliance: "Legal & People", "People/HR": "Legal & People",
  "Recruiter/TA": "Legal & People",
  "Real Estate": "Other sectors", Healthcare: "Other sectors", "Skilled Trades": "Other sectors",
  Retail: "Other sectors", "Health & Safety": "Other sectors", "Teaching/Education": "Other sectors",
};

/** Display order for the category browse row. */
export const CATEGORY_ORDER = [
  "Engineering", "Data", "Product", "Design", "Go-to-market",
  "Operations", "Finance", "Legal & People", "Other sectors",
];

export function familyCategory(family: string): string {
  return FAMILY_CATEGORY[family] ?? "Other sectors";
}
