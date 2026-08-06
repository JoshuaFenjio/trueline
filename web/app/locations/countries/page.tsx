import type { Metadata } from "next";
import { getCountryIndex, getLiveStats, isConfigured } from "@/lib/data";
import { SectionHeader, RankTable, toPayVMs, toVolumeVMs, Breadcrumbs, StatStrip } from "@/components/blocks";
import { SubNav } from "@/components/SubNav";
import { eur } from "@/lib/format";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Salaries by country in Europe",
  description: "How tech pay compares across EMEA countries, ranked by median advertised base, live from company job postings.",
};

const SALARIES_NAV = [
  { label: "Roles", href: "/roles" },
  { label: "Cities", href: "/locations" },
  { label: "Countries", href: "/locations/countries" },
];

export default async function CountriesIndex() {
  if (!isConfigured) return <p className="py-24 text-center text-ink-muted">Supabase not configured.</p>;
  const [countries, stats] = await Promise.all([getCountryIndex(), getLiveStats()]);

  const ranked = countries.filter((c) => c.median != null);
  const byVolume = [...countries].sort((a, b) => b.n - a.n).slice(0, 15);
  const topMedian = ranked[0];

  return (
    <div className="py-12">
      <Breadcrumbs items={[{ label: "Salaries", href: "/roles" }, { label: "Countries" }]} />
      <div className="mt-4"><SubNav items={SALARIES_NAV} /></div>

      <SectionHeader kicker="Salaries · by country" title="How markets compare" sub="Median advertised base by country across EMEA, live from company job boards. Country medians unlock at 8 postings." />

      <div className="mt-7">
        <StatStrip
          items={[
            { value: countries.length, label: "Countries tracked" },
            { value: topMedian ? eur(topMedian.median!) : "—", label: topMedian ? `Top: ${topMedian.name}` : "Top median" },
            { value: stats.salaried.toLocaleString(), label: "Salaried ads" },
            { value: byVolume[0]?.name ?? "—", label: "Most postings" },
          ]}
        />
      </div>

      <section className="mt-14">
        <SectionHeader kicker="Ranked" title="Highest-paying countries" />
        <div className="mt-5">
          {ranked.length
            ? <RankTable rows={toPayVMs(ranked.map((c) => ({ label: c.name, slug: c.slug, value: c.median!, n: c.n })), (s) => `/locations/country/${s}`)} />
            : <p className="text-sm text-ink-faint">No country clears the 8-posting gate yet.</p>}
        </div>
      </section>

      <section className="mt-16">
        <SectionHeader kicker="Coverage" title="Most-tracked countries" sub="Where we have the most salaried postings right now." />
        <div className="mt-5">
          <RankTable rows={toVolumeVMs(byVolume, (s) => `/locations/country/${s}`)} valueHead="Postings" />
        </div>
      </section>
    </div>
  );
}
