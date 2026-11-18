import type { Metadata } from "next";
import Link from "next/link";
import { getTransparencyStats, getLastRefreshed, isConfigured } from "@/lib/data";
import { Breadcrumbs } from "@/components/blocks";
import { Flag } from "@/components/Flag";
import { JsonLd, FaqBlock } from "@/components/Seo";
import { datasetLd, monthYear, eurExact, currentYear, BRAND, type Faq } from "@/lib/seo";
import { inPlace, EMEA_PLACE } from "@/lib/seoCopy";
import { slugify } from "@/lib/format";

export const revalidate = 3600;
const PATH = "/insights/salary-transparency-statistics";

const ATS_LABEL: Record<string, string> = {
  greenhouse: "Greenhouse", lever: "Lever", ashby: "Ashby", smartrecruiters: "SmartRecruiters",
  recruitee: "Recruitee", teamtailor: "Teamtailor", personio: "Personio", workable: "Workable",
  germantechjobs: "GermanTechJobs", himalayas: "Himalayas", landing: "Landing.jobs", itjobs: "ITJobs.pt",
  adzuna: "Adzuna", reed: "Reed",
};
const atsLabel = (a: string) => ATS_LABEL[a] ?? a;
const fmt = (n: number) => n.toLocaleString("en-IE");

export async function generateMetadata(): Promise<Metadata> {
  const y = currentYear();
  const base = { alternates: { canonical: PATH } };
  if (!isConfigured) return { ...base, title: `Salary Transparency Statistics ${y}` };
  const s = await getTransparencyStats();
  return {
    ...base,
    title: `Salary Transparency Statistics ${y}: ${s.pct}% of job ads state pay`,
    description: `${s.pct}% of ${fmt(s.tracked)} live job ads on employers' own job boards across EMEA tracked by ${BRAND} state a salary. Disclosure rates by country and job-board platform, medians by country, and EU Pay Transparency Directive context.`,
  };
}

export default async function TransparencyStatsPage() {
  if (!isConfigured) return <p className="py-24 text-center text-ink-muted">Supabase not configured.</p>;
  const [s, refreshed] = await Promise.all([getTransparencyStats(), getLastRefreshed()]);
  const updated = monthYear(refreshed);
  const upd = updated ? ` (updated ${updated})` : "";
  const hi = s.byCountry[0], lo = s.byCountry[s.byCountry.length - 1];
  const boards = s.byAts.filter((a) => !a.filtered);
  const atsHi = boards[0], atsLo = boards[boards.length - 1];
  // Headline "highest median" uses the flagship depth (15 salaried ads), so a
  // thin sample can't headline; the table below still lists every country.
  const medians = s.byCountry.filter((c) => c.median != null && c.n >= 15).sort((a, b) => b.median! - a.median!);

  // Each statistic is a complete, citable sentence: subject, figure, sample,
  // source and date — so it survives being quoted on its own.
  const stats: string[] = [
    `On employers' own job boards, ${s.pct}% of the ${fmt(s.tracked)} live job ads across ${EMEA_PLACE} tracked by ${BRAND} state a salary${upd}.`,
    `On employers' own job boards in EU member states, ${s.eu.pct}% of ${fmt(s.eu.tracked)} live job ads state a salary, compared with ${s.nonEu.pct}% of ${fmt(s.nonEu.tracked)} ads in countries outside the EU${s.nonEuCountries.length ? ` (largest: ${s.nonEuCountries.map(inPlace).join(", ")})` : ""}, per ${BRAND} data${upd}.`,
  ];
  if (hi && lo && hi !== lo) stats.push(`Among countries with at least 100 live job ads tracked by ${BRAND}, pay disclosure on employers' own job boards is highest in ${inPlace(hi.name)} (${hi.pct}% of ${fmt(hi.tracked)} ads) and lowest in ${inPlace(lo.name)} (${lo.pct}% of ${fmt(lo.tracked)} ads)${upd}.`);
  if (atsHi && atsLo && atsHi !== atsLo) stats.push(`By job-board platform, ${atsHi.pct}% of the ${fmt(atsHi.tracked)} live job ads published through ${atsLabel(atsHi.name)} state a salary, versus ${atsLo.pct}% of ${fmt(atsLo.tracked)} on ${atsLabel(atsLo.name)}, per ${BRAND} data${upd}.`);
  if (s.emeaMedian) stats.push(`The median advertised base salary across all ${fmt(s.salaried)} salaried live job ads in ${EMEA_PLACE} tracked by ${BRAND} is ${eurExact(s.emeaMedian)}${upd}.`);
  if (medians[0]) stats.push(`Among countries with at least 100 live employer job-board ads and 15 salaried ads, ${inPlace(medians[0].name)} has the highest median advertised base salary at ${eurExact(medians[0].median!)}, from ${fmt(medians[0].n)} salaried ads tracked by ${BRAND}${upd}.`);

  const directive = "The EU Pay Transparency Directive (Directive (EU) 2023/970) had to be transposed into national law by 7 June 2026. It requires employers to give job applicants information on the initial pay, or its range, for a position — in the vacancy notice or before the interview.";

  const faqs: Faq[] = [
    { q: "What share of job ads in Europe state a salary?", a: stats[0] },
    { q: "Do job ads in the EU disclose pay more often than elsewhere?", a: stats[1] },
  ];
  if (hi && lo && hi !== lo) faqs.push({ q: "Which country has the highest rate of salary disclosure in job ads?", a: stats[2] });
  faqs.push({ q: "What does the EU Pay Transparency Directive require?", a: directive });

  return (
    <div className="mx-auto max-w-3xl pb-4">
      <div className="pt-8"><Breadcrumbs items={[{ label: "Insights", href: "/insights" }, { label: "Salary transparency statistics" }]} /></div>
      <h1 className="t-h2 mt-6">Salary transparency statistics</h1>
      <p className="mt-3 text-ink-muted">Computed live from the job ads {BRAND} tracks across {EMEA_PLACE}. A job ad counts as disclosing pay when it states a salary we can read. Disclosure rates use employers&rsquo; own job boards only ({fmt(s.tracked)} ads), where we read every ad a company publishes; {fmt(s.filteredTracked)} ads from job boards that only list salaried roles are left out of the rates, though their salaries count in the medians.{updated ? ` Data updated ${updated}.` : ""}</p>

      <section className="mt-8" data-stats>
        <h2 className="text-xl font-semibold">Key statistics</h2>
        <ul className="mt-4 space-y-3">
          {stats.map((t) => <li key={t} className="card !py-4 text-[15px] leading-relaxed">{t}</li>)}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Pay disclosure and median salary by country</h2>
        <p className="mt-1 text-[13px] text-ink-faint">Countries with at least 100 live ads on employers&rsquo; own job boards. Median (all salaried ads) shown once a country has 8.</p>
        <div className="mt-4 card overflow-x-auto !p-0">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-[12px] text-ink-faint"><th className="px-4 py-2.5">Country</th><th className="px-4 py-2.5 text-right">Employer-board ads</th><th className="px-4 py-2.5 text-right">State pay</th><th className="px-4 py-2.5 text-right">Median base</th></tr></thead>
            <tbody>
              {s.byCountry.map((c) => (
                <tr key={c.name} className="border-t" style={{ borderColor: "var(--border)" }}>
                  <td className="px-4 py-2"><Link href={`/locations/country/${slugify(c.name)}`} className="inline-flex items-center gap-2 hover:text-[var(--accent)]"><Flag country={c.name} />{c.name}</Link></td>
                  <td className="tnum px-4 py-2 text-right">{fmt(c.tracked)}</td>
                  <td className="tnum px-4 py-2 text-right font-semibold">{c.pct}%</td>
                  <td className="tnum px-4 py-2 text-right">{c.median != null ? eurExact(c.median) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Pay disclosure by job-board platform</h2>
        <p className="mt-1 text-[13px] text-ink-faint">Platforms with at least 100 live job ads. Boards marked &ldquo;salaried only&rdquo; list only ads that carry a salary, so their rate reflects the board&rsquo;s rules, not employer behaviour.</p>
        <div className="mt-4 card overflow-x-auto !p-0">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-[12px] text-ink-faint"><th className="px-4 py-2.5">Platform</th><th className="px-4 py-2.5 text-right">Live ads</th><th className="px-4 py-2.5 text-right">State pay</th></tr></thead>
            <tbody>
              {s.byAts.map((a) => (
                <tr key={a.name} className="border-t" style={{ borderColor: "var(--border)" }}>
                  <td className="px-4 py-2">{atsLabel(a.name)}{a.filtered && <span className="ml-2 text-[11px] text-ink-faint">salaried only</span>}</td>
                  <td className="tnum px-4 py-2 text-right">{fmt(a.tracked)}</td>
                  <td className="tnum px-4 py-2 text-right font-semibold">{a.pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">The EU Pay Transparency Directive</h2>
        <p className="mt-2 leading-relaxed text-ink-muted">{directive}</p>
      </section>

      <FaqBlock faqs={faqs} />

      <section className="mt-10 text-[13px] text-ink-faint">
        <p>Method: every live job ad on the company job boards and platforms we read, deduplicated; a salary counts as disclosed when the ad states one we can parse and trust. Medians are of annual base salary, currency-normalised to EUR. See the <Link href="/methodology" className="underline">methodology</Link>.</p>
      </section>

      <JsonLd data={datasetLd({
        name: "SalaryRadar salary transparency statistics",
        description: stats.join(" "),
        path: PATH, dateModified: refreshed,
        variableMeasured: ["Share of job ads on employers' own job boards stating a salary", "Live job ads tracked", "Median advertised annual base salary (EUR)"],
        spatialCoverage: "Europe, the Middle East and Africa (EMEA)",
        keywords: ["pay transparency", "salary disclosure", "EU Pay Transparency Directive", "job ads"],
      })} />
    </div>
  );
}
