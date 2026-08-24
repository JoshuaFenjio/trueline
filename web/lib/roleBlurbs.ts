// Neutral one-line descriptions per role family. No salary claims — those come
// from live data on the page. Keyed by our roleFamily taxonomy; falls back to a
// generic line for anything unmapped.
export const ROLE_BLURBS: Record<string, string> = {
  "Software Engineer": "Designs, builds and ships software across the stack.",
  Backend: "Builds server-side services, APIs and data layers.",
  Frontend: "Builds the user-facing web interface and client logic.",
  Mobile: "Builds native and cross-platform mobile applications.",
  "DevOps/Platform": "Runs infrastructure, CI/CD and internal developer platforms.",
  "Data Engineer": "Builds and maintains data pipelines and warehouses.",
  "Data Scientist": "Models data to answer product and business questions.",
  "Data Analyst": "Turns raw data into reporting, dashboards and insight.",
  "ML/AI Engineer": "Builds and deploys machine-learning and AI systems.",
  "Security Engineer": "Protects systems, data and users from threats.",
  "Engineering Manager": "Leads and grows teams of engineers.",
  "QA/Test": "Assures software quality through testing and automation.",
  "Product Manager": "Owns product direction, roadmap and delivery.",
  Designer: "Shapes product experience, interface and visual design.",
  "Sales/AE": "Wins and grows customer accounts and revenue.",
  Marketing: "Drives demand, brand and go-to-market.",
  "Customer Success": "Keeps customers onboarded, retained and growing.",
  Operations: "Keeps the business running across teams and processes.",
  Finance: "Manages budgeting, reporting and financial planning.",
  Legal: "Handles contracts, compliance and legal risk.",
  "People/HR": "Recruits, develops and supports the workforce.",
};

export function roleBlurb(role: string): string {
  return ROLE_BLURBS[role] ?? "Advertised roles in this family across EMEA employers.";
}

// A representative icon name (from components/icons) per family.
export function roleIconName(role: string): string {
  const map: Record<string, string> = {
    "Software Engineer": "code", Backend: "code", Frontend: "code", Mobile: "code",
    "DevOps/Platform": "refresh", "Data Engineer": "layers", "Data Scientist": "bars",
    "Data Analyst": "bars", "ML/AI Engineer": "spark", "Security Engineer": "shield",
    "Engineering Manager": "users", "QA/Test": "check", "Product Manager": "target",
    Designer: "spark", "Sales/AE": "trending", Marketing: "trending",
    "Customer Success": "users", Operations: "refresh", Finance: "bars",
    Legal: "scale", "People/HR": "users",
  };
  return map[role] ?? "briefcase";
}
