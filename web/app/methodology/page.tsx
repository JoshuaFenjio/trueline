import type { Metadata } from "next";
import { Breadcrumbs, PillButton } from "@/components/blocks";
import { allPhotoCredits } from "@/lib/cityImages";
import { getLiveStats, getCountryIndex, getCityIndex, getRoleIndex, getLastRefreshed, isConfigured } from "@/lib/data";
import { JsonLd } from "@/components/Seo";
import { datasetLd, monthYear } from "@/lib/seo";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Methodology",
  description:
    "How SalaryRadar builds its salary benchmarks: sources, base pay vs total comp, city-level data, sample gates, advertised vs offered, and how Pay Score works.",
  alternates: { canonical: "/methodology" },
};

const SECTIONS = [
  {
    id: "source",
    title: "Where the numbers come from",
    body: "Every figure is scraped from public job postings on companies’ own applicant tracking systems: Greenhouse, Lever, Ashby, SmartRecruiters, Recruitee and Teamtailor. We read the salary a company published itself. Where a posting exposes structured pay fields we use those; otherwise we parse the range conservatively from the job description and drop anything ambiguous.",
  },
  {
    id: "base-not-tc",
    title: "Base salary, not total comp",
    body: "We report advertised base salary only. Bonuses, equity and benefits vary too much to compare honestly from a job ad, so we leave them out rather than guess. A base figure you can trust beats a total-comp number we invented.",
  },
  {
    id: "city-level",
    title: "Why city, not country",
    body: "Pay in London, Paris, Berlin and Warsaw differs enormously within one country once you leave the capital. We anchor every benchmark to the city on the posting where we can, and only fall back to the country when no city is given.",
  },
  {
    id: "sample-gates",
    title: "Sample gates: when we stay quiet",
    body: "We never show a median from a handful of postings. A role-and-city query needs at least 8 recent salaried postings before we publish a number. Per-company medians need 3, per-city breakdowns need 5. Below the gate we say ‘not enough data yet’ instead of inventing a figure.",
  },
  {
    id: "advertised-vs-offered",
    title: "Advertised is not offered",
    body: "An advertised range is what a company is willing to state publicly. The offer you receive can land anywhere inside it, and occasionally outside. Treat these as market signal, not a promise. Verified salary submissions help close the gap between the two.",
  },
  {
    id: "who-pays",
    title: "How Pay Score works",
    body: "A company’s Pay Score is the percentile of its median advertised base against peers in the same sector, from 0 to 100. It is relative, not absolute: an 80 means ‘pays well for its sector’, not ‘pays the most in Europe’.",
  },
];

// Live dataset facts — the visible card and the Dataset JSON-LD are built from
// these same numbers, so the markup can never claim a count the page doesn't.
async function datasetFacts() {
  if (!isConfigured) return null;
  const [stats, countries, cities, roles, refreshed] = await Promise.all([
    getLiveStats(), getCountryIndex(), getCityIndex(), getRoleIndex(), getLastRefreshed(),
  ]);
  const f = {
    postings: stats.postings, salaried: stats.salaried, disclosed: stats.disclosed, companies: stats.companies,
    countries: countries.filter((c) => c.median != null).length,
    cities: cities.filter((c) => c.median != null).length,
    roles: roles.filter((r) => r.median != null && r.name !== "Other").length,
    refreshed, updated: monthYear(refreshed),
  };
  const description =
    `SalaryRadar's live salary dataset: ${f.postings.toLocaleString("en-IE")} live job ads from ${f.companies.toLocaleString("en-IE")} employers across Europe, the Middle East and Africa, of which ${f.disclosed.toLocaleString("en-IE")} disclose pay and ${f.salaried.toLocaleString("en-IE")} carry an annual base salary usable for a median. ` +
    `Medians are published for ${f.roles} role families, ${f.countries} countries and ${f.cities} cities, each only once it has at least 8 salaried ads${f.updated ? `. Updated ${f.updated}` : ""}.`;
  return { ...f, description };
}

export default async function MethodologyPage() {
  const ds = await datasetFacts();
  return (
    <div className="mx-auto max-w-2xl pb-4">
      <div className="pt-8"><Breadcrumbs items={[{ label: "Methodology" }]} /></div>
      <span className="eyebrow-pill mt-6"><span className="eyebrow">Methodology</span></span>
      <h1 className="t-h1 mt-5">How we know <span className="accent-italic">what&rsquo;s true.</span></h1>
      <p className="mt-4 text-lg leading-relaxed text-ink-muted">
        SalaryRadar is built to be honest about what it does and doesn&rsquo;t know. Here is exactly how the numbers are made.
      </p>

      <nav className="mt-8 flex flex-wrap gap-2">
        {SECTIONS.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="pill-btn">{s.title}</a>
        ))}
      </nav>

      <div className="mt-8 space-y-4">
        {SECTIONS.map((s, i) => (
          <section key={s.id} id={s.id} className="card scroll-mt-24">
            <div className="flex items-center gap-3">
              <span className="tnum flex h-7 w-7 items-center justify-center rounded-lg text-[13px] font-semibold" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>{i + 1}</span>
              <h2 className="text-[17px] font-semibold">{s.title}</h2>
            </div>
            <p className="mt-2.5 leading-relaxed text-ink-muted">{s.body}</p>
          </section>
        ))}
      </div>

      {ds && (
        <section id="dataset" className="card mt-8 scroll-mt-24" data-dataset>
          <h2 className="text-[17px] font-semibold">The dataset</h2>
          <p className="mt-2.5 leading-relaxed text-ink-muted">{ds.description}</p>
          <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {([
              ["Live job ads", ds.postings], ["Disclose pay", ds.disclosed], ["Usable salaries", ds.salaried], ["Employers", ds.companies],
              ["Role families published", ds.roles], ["Countries published", ds.countries], ["Cities published", ds.cities],
            ] as [string, number][]).map(([k, v]) => (
              <div key={k}><dt className="text-[11px] text-ink-faint">{k}</dt><dd className="tnum mt-1 text-lg font-semibold">{v.toLocaleString("en-IE")}</dd></div>
            ))}
          </dl>
          <JsonLd data={datasetLd({
            name: "SalaryRadar EMEA advertised salary dataset",
            description: ds.description, path: "/methodology", dateModified: ds.refreshed,
            variableMeasured: ["Median advertised annual base salary (EUR)", "Salary percentiles (P10, P25, P75, P90)", "Pay disclosure rate", "Salaried job-ad sample size"],
            spatialCoverage: "Europe, the Middle East and Africa (EMEA)",
            keywords: ["salary", "pay transparency", "job postings", "EMEA", "salary benchmark"],
          })} />
        </section>
      )}

      {allPhotoCredits().length > 0 && (
        <section className="mt-8">
          <h2 className="text-[15px] font-semibold">Photo credits</h2>
          <p className="mt-1 text-[13px] text-ink-muted">City and country hero photos via Unsplash (Unsplash License).</p>
          <p className="mt-2 text-[12px] leading-relaxed text-ink-faint">
            {allPhotoCredits().map((c, i) => (
              <span key={c.slug}>
                {i > 0 ? " · " : ""}
                <span className="capitalize text-ink-muted">{c.slug.replace(/-/g, " ")}</span>:{" "}
                {c.link ? <a href={c.link} target="_blank" rel="noopener noreferrer" className="hover:text-ink">{c.author}</a> : c.author}
              </span>
            ))}
          </p>
        </section>
      )}

      <section className="section-y">
        <div className="band-dark flex flex-col gap-6 p-8 md:flex-row md:items-center md:justify-between">
          <h2 className="text-xl font-bold text-white">See the honest numbers for yourself.</h2>
          <div className="flex gap-3"><PillButton href="/" light>Search the data</PillButton><PillButton href="/leaderboards" light>Leaderboards</PillButton></div>
        </div>
      </section>
    </div>
  );
}
