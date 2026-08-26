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
  "Product Marketing": "Positions the product, drives launches and messaging.",
  Designer: "Shapes product experience, interface and visual design.",
  "Research Scientist": "Advances the state of the art through applied research.",
  "SecOps": "Detects, investigates and responds to security threats.",
  "Hardware/Embedded": "Designs hardware, firmware and embedded systems.",
  "Solutions Engineer": "Wins technical deals through pre-sales and solutioning.",
  // Go-to-market
  "Account Executive": "Wins new customers and closes revenue.",
  "Account Manager": "Grows and retains existing customer accounts.",
  "SDR/BDR": "Prospects and qualifies new sales pipeline.",
  "BizDev/Partnerships": "Builds partnerships and channel-driven growth.",
  Marketing: "Drives demand and go-to-market.",
  Content: "Creates content, copy and editorial across channels.",
  Brand: "Shapes brand, communications, community and events.",
  "Performance Marketing": "Runs paid acquisition, SEO and growth channels.",
  "Customer Success": "Keeps customers onboarded, retained and growing.",
  Support: "Resolves customer issues and technical questions.",
  // Operations
  Operations: "Keeps the business running across teams and processes.",
  BizOps: "Runs revenue, sales and business operations.",
  Strategy: "Drives strategy, chief-of-staff and corporate development.",
  Consultant: "Advises clients and implements solutions.",
  "Office/EA": "Runs the workplace and supports leadership.",
  // Finance
  Finance: "Manages budgeting, reporting and financial planning.",
  "FP&A": "Owns financial planning, forecasting and analysis.",
  Accounting: "Handles the books, controls, tax and audit.",
  Payroll: "Runs payroll and employee compensation operations.",
  // Legal / people
  Legal: "Handles contracts and legal risk.",
  Compliance: "Manages regulatory, risk and financial-crime controls.",
  "People/HR": "Develops and supports the workforce.",
  "Recruiter/TA": "Sources and hires talent across the business.",
};

export function roleBlurb(role: string): string {
  return ROLE_BLURBS[role] ?? "Advertised roles in this family across EMEA employers.";
}

// A representative icon name (from components/icons) per family.
export function roleIconName(role: string): string {
  const map: Record<string, string> = {
    "Software Engineer": "code", Backend: "code", Frontend: "code", Mobile: "code",
    "DevOps/Platform": "refresh", "Data Engineer": "layers", "Data Scientist": "bars",
    "Data Analyst": "bars", "ML/AI Engineer": "spark", "Research Scientist": "spark",
    "Security Engineer": "shield", SecOps: "shield", "Hardware/Embedded": "layers",
    "Engineering Manager": "users", "QA/Test": "check", "Product Manager": "target",
    "Product Marketing": "target", Designer: "spark", "Solutions Engineer": "code",
    // Go-to-market
    "Account Executive": "trending", "Account Manager": "users", "SDR/BDR": "trending",
    "BizDev/Partnerships": "trending", Marketing: "trending", Content: "doc",
    Brand: "spark", "Performance Marketing": "trending",
    "Customer Success": "users", Support: "users",
    // Operations
    Operations: "refresh", BizOps: "refresh", Strategy: "target", Consultant: "briefcase",
    "Office/EA": "building",
    // Finance
    Finance: "bars", "FP&A": "bars", Accounting: "bars", Payroll: "bars",
    // Legal / people
    Legal: "scale", Compliance: "shield", "People/HR": "users", "Recruiter/TA": "users",
  };
  return map[role] ?? "briefcase";
}
