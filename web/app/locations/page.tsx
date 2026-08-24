import type { Metadata } from "next";
import Link from "next/link";
import { getCityMapData, getLiveStats, isConfigured } from "@/lib/data";
import { SectionHeader, Breadcrumbs, PillButton } from "@/components/blocks";
import { HubExplorer, HubItem } from "@/components/HubExplorer";
import { Flag } from "@/components/Flag";
import { Icon } from "@/components/icons";
import { subregionOf, SUBREGIONS } from "@/lib/subregion";
import { eur, slugify } from "@/lib/format";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Salaries by city in Europe",
  description: "What tech roles pay in each European city, ranked by median advertised base, live from company job postings.",
};

export default async function CitiesIndex() {
  if (!isConfigured) return <p className="py-24 text-center text-ink-muted">Supabase not configured.</p>;
  const [map, stats] = await Promise.all([getCityMapData(), getLiveStats()]);
  const cities = [...map.cities].sort((a, b) => b.median - a.median);
  const topMarkets = [...map.cities].sort((a, b) => b.n - a.n).slice(0, 6);
  const items: HubItem[] = cities.map((c) => ({ name: c.city, slug: c.slug, median: c.median, n: c.n, flagCountry: c.country, href: `/locations/${c.slug}` }));

  const regionCounts = SUBREGIONS.map((r) => ({ region: r, n: map.cities.filter((c) => subregionOf(c.country) === r).length })).filter((r) => r.n > 0);

  return (
    <div className="pb-4">
      <div className="pt-8"><Breadcrumbs items={[{ label: "Salaries", href: "/roles" }, { label: "Cities" }]} /></div>

      {/* Hero */}
      <section className="mt-6 grid items-center gap-8 lg:grid-cols-[1fr_.7fr]">
        <div>
          <span className="eyebrow-pill"><span className="eyebrow">{map.cities.length} cities · live</span></span>
          <h1 className="t-h1 mt-5">Explore pay<br /><span className="font-normal italic">by city across Europe.</span></h1>
          <p className="mt-4 max-w-lg text-lg leading-relaxed text-ink-muted">Median advertised base by tech hub, live from company job boards. A city median needs 8 salaried postings before it shows.</p>
        </div>
        <div className="card-float p-6">
          <div className="text-[12px] text-ink-faint">Cities tracked</div>
          <div className="tnum mt-1 text-3xl font-semibold">{map.cities.length}</div>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div><div className="tnum text-lg font-semibold">{eur(cities[0]?.median ?? 0)}</div><div className="text-[11px] text-ink-faint">Top: {cities[0]?.city}</div></div>
            <div><div className="tnum text-lg font-semibold">{stats.salaried.toLocaleString()}</div><div className="text-[11px] text-ink-faint">Salaried ads</div></div>
          </div>
        </div>
      </section>

      {/* Top markets */}
      <section className="mt-12">
        <SectionHeader kicker="Top markets" title="Most-tracked cities" />
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {topMarkets.map((c) => (
            <Link key={c.slug} href={`/locations/${c.slug}`} className="rounded-[14px] p-4 transition-colors hover:brightness-[.98]" style={{ background: "var(--panel)" }}>
              <div className="flex items-center gap-2"><Flag country={c.country} /><span className="truncate text-sm font-medium">{c.city}</span></div>
              <div className="tnum mt-2 text-lg font-semibold">{eur(c.median)}</div>
              <div className="tnum text-[11px] text-ink-faint">{c.n} salaried</div>
            </Link>
          ))}
        </div>
      </section>

      {/* Explore */}
      <section className="mt-14">
        <SectionHeader kicker="Explore" title="All tracked cities" />
        <div className="mt-5"><HubExplorer items={items} placeholder="Search a city…" unit="salaried" /></div>
      </section>

      {/* Browse by region */}
      <section className="mt-14">
        <SectionHeader kicker="By region" title="Browse by region" />
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {regionCounts.map((r) => (
            <div key={r.region} className="card">
              <span className="icon-chip"><Icon.globe size={15} /></span>
              <div className="mt-3 text-[15px] font-semibold">{r.region}</div>
              <div className="tnum mt-1 text-[13px] text-ink-faint">{r.n} cities tracked</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="section-y grid gap-5 md:grid-cols-2">
        <div className="card flex flex-col gap-3"><div className="flex items-center gap-2.5"><span className="icon-chip"><Icon.scale size={15} /></span><span className="text-[15px] font-semibold">Compare countries</span></div><p className="text-[14px] text-ink-muted">Zoom out to the country view across every EMEA market.</p><div className="mt-1"><PillButton href="/locations/countries">All countries</PillButton></div></div>
        <div className="card flex flex-col gap-3"><div className="flex items-center gap-2.5"><span className="icon-chip"><Icon.users size={15} /></span><span className="text-[15px] font-semibold">Add your salary</span></div><p className="text-[14px] text-ink-muted">Help sharpen city benchmarks — anonymously, in a minute.</p><div className="mt-1"><PillButton href="/add">Add your salary</PillButton></div></div>
      </section>
    </div>
  );
}
