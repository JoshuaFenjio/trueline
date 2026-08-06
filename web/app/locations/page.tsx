import type { Metadata } from "next";
import { getCityIndex, getCityMapData, getLiveStats, isConfigured } from "@/lib/data";
import { SectionHeader, RankTable, toVolumeVMs, Breadcrumbs, StatStrip } from "@/components/blocks";
import { TopCities } from "@/components/TopCities";
import { SubNav } from "@/components/SubNav";
import { eur } from "@/lib/format";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Salaries by city in Europe",
  description: "What tech roles pay in each European city, ranked by median advertised base, live from company job postings.",
};

const SALARIES_NAV = [
  { label: "Roles", href: "/roles" },
  { label: "Cities", href: "/locations" },
  { label: "Countries", href: "/locations/countries" },
];

export default async function CitiesIndex() {
  if (!isConfigured) return <p className="py-24 text-center text-ink-muted">Supabase not configured.</p>;
  const [cities, map, stats] = await Promise.all([getCityIndex(), getCityMapData(), getLiveStats()]);

  const topMedian = cities.find((c) => c.median != null);
  const byVolume = [...cities].sort((a, b) => b.n - a.n).slice(0, 15);

  return (
    <div className="py-12">
      <Breadcrumbs items={[{ label: "Salaries", href: "/roles" }, { label: "Cities" }]} />
      <div className="mt-4"><SubNav items={SALARIES_NAV} /></div>

      <SectionHeader kicker="Salaries · by city" title="What each city pays" sub="Median advertised base by tech hub, live from company job boards. City medians unlock at 8 postings." />

      <div className="mt-7">
        <StatStrip
          items={[
            { value: stats.cities.toLocaleString(), label: "Cities tracked" },
            { value: topMedian ? eur(topMedian.median!) : "—", label: topMedian ? `Top: ${topMedian.name}` : "Top median" },
            { value: stats.salaried.toLocaleString(), label: "Salaried ads" },
            { value: byVolume[0]?.name ?? "—", label: "Most postings" },
          ]}
        />
      </div>

      <section className="mt-14">
        <SectionHeader kicker="Ranked" title="Top-paying cities" />
        <div className="mt-5">
          {map.cities.length
            ? <TopCities cities={map.cities} emeaMedian={map.emeaMedian} />
            : <p className="text-sm text-ink-faint">No city clears the 8-posting gate yet.</p>}
        </div>
      </section>

      <section className="mt-16">
        <SectionHeader kicker="Coverage" title="Most-tracked cities" sub="Where we have the most salaried postings right now." />
        <div className="mt-5">
          <RankTable rows={toVolumeVMs(byVolume, (s) => `/locations/${s}`)} valueHead="Postings" />
        </div>
      </section>
    </div>
  );
}
