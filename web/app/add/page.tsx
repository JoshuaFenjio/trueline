import type { Metadata } from "next";
import { submitSalary } from "./actions";
import { Card } from "@/components/ui";
import { Breadcrumbs } from "@/components/blocks";
import { AddSalaryForm } from "@/components/AddSalaryForm";
import { getRoleFamilies, getCityList, getCountryList, getCompaniesBoard, isConfigured } from "@/lib/data";

export const metadata: Metadata = {
  title: "Add your salary",
  description: "Add your salary anonymously to improve Europe's pay benchmarks. Reviewed by a human, never attributed to you.",
};

export const revalidate = 3600;

// Families we accept a submission for, over and above the ones currently in the
// corpus — so someone can tell us about a role we don't label yet.
const EXTRA_FAMILIES = ["Other"];

export default async function AddPage({ searchParams }: { searchParams: { error?: string; company?: string } }) {
  const error = searchParams.error;
  const company = (searchParams.company || "").slice(0, 120);

  // Every type-ahead is fed from what we actually track, so a submission lands
  // on the same entity the benchmarks use instead of a near-miss spelling.
  const [roles, cities, countries, board] = isConfigured
    ? await Promise.all([getRoleFamilies(), getCityList(), getCountryList(), getCompaniesBoard()])
    : [[], [], [], []];
  const options = {
    roles: [...new Set([...roles, ...EXTRA_FAMILIES])],
    cities: cities.map((c) => c.city),
    countries: countries.map((c) => c.country),
    companies: board.map((c) => c.company),
  };

  return (
    <div className="mx-auto max-w-2xl pb-4">
      <div className="pt-8"><Breadcrumbs items={[{ label: "Add your salary" }]} /></div>
      <span className="eyebrow-pill mt-6"><span className="eyebrow">Add your salary</span></span>
      <h1 className="t-h1 mt-5">Add your salary <span className="accent-italic">anonymously.</span></h1>
      <p className="mt-4 text-lg leading-relaxed text-ink-muted">
        Advertised ranges tell you what employers offer. What people actually earn is the other half — and only you
        can tell us that. Takes about a minute.
      </p>

      {error && (
        <div className="mt-6 rounded-card border p-4" style={{ background: "rgba(255,106,69,.08)", borderColor: "rgba(255,106,69,.35)" }}>
          <p className="text-sm" style={{ color: "var(--ember)" }}>
            {error === "missing" ? "Please fill in role family, exact title, company and base salary."
              : error === "config" ? "Submissions aren't configured yet."
              : "Something went wrong saving that. Please try again."}
          </p>
        </div>
      )}

      <Card className="mt-6">
        <AddSalaryForm action={submitSalary} options={options} defaultCompany={company} />
      </Card>
    </div>
  );
}
