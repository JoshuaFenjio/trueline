import type { Metadata } from "next";
import Link from "next/link";
import { getCountryLeaderboard, getLiveStats, getEuropePayData, isConfigured } from "@/lib/data";
import { SectionHeader, Breadcrumbs, PillButton } from "@/components/blocks";
import { HubExplorer, HubItem } from "@/components/HubExplorer";
import { CountryRoleRanker } from "@/components/CountryRoleRanker";
import { Flag } from "@/components/Flag";
import { Icon } from "@/components/icons";
import { subregionOf, SUBREGIONS } from "@/lib/subregion";
import { eur, slugify } from "@/lib/format";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Salaries by country in Europe",
  description: "How tech pay compares across EMEA countries, ranked by median advertised base, live from company job postings.",
};

export default async function CountriesIndex() {
  if (!isConfigured) return <p className="py-24 text-center text-ink-muted">Supabase not configured.</p>;
  const [countries, stats, europe] = await Promise.all([getCountryLeaderboard(), getLiveStats(), getEuropePayData()]);
  const topMarkets = [...countries].sort((a, b) => b.n - a.n).slice(0, 6);
  const items: HubItem[] = countries.map((c) => ({ name: c.country, slug: slugify(c.country), median: c.median, n: c.n, flagCountry: c.country, href: `/locations/country/${slugify(c.country)}` }));
  const regionCounts = SUBREGIONS.map((r) => ({ region: r, n: countries.filter((c) => subregionOf(c.country) === r).length })).filter((r) => r.n > 0);

  return (
    <div className="pb-4">
      <div className="pt-8"><Breadcrumbs items={[{ label: "Salaries", href: "/roles" }, { label: "Countries" }]} /></div>

      <section className="mt-6 grid items-center gap-8 lg:grid-cols-[1fr_.7fr]">
        <div>
          <span className="eyebrow-pill"><span className="eyebrow">{countries.length} countries · live</span></span>
          <h1 className="t-h1 mt-5">Explore pay<br /><span className="accent-italic">by country across Europe.</span></h1>
          <p className="mt-4 max-w-lg text-lg leading-relaxed text-ink-muted">How tech pay compares across EMEA markets, live from company job boards. A country median needs 8 salaried postings before it shows.</p>
        </div>
        <div className="card-float p-6">
          <div className="text-[12px] text-ink-faint">Countries tracked</div>
          <div className="tnum mt-1 text-3xl font-semibold">{countries.length}</div>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div><div className="tnum text-lg font-semibold">{eur(countries[0]?.median ?? 0)}</div><div className="text-[11px] text-ink-faint">Top: {countries[0]?.country}</div></div>
            <div><div className="tnum text-lg font-semibold">{stats.salaried.toLocaleString()}</div><div className="text-[11px] text-ink-faint">Salaried ads</div></div>
          </div>
        </div>
      </section>

      <section className="mt-12">
        <SectionHeader kicker="Rank by role" title="Which countries pay most — by role" sub="Pick a role to re-rank every market by its median advertised base." />
        <div className="mt-5"><CountryRoleRanker data={europe} /></div>
      </section>

      <section className="mt-12">
        <SectionHeader kicker="Top markets" title="Most-tracked countries" />
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {topMarkets.map((c) => (
            <Link key={c.country} href={`/locations/country/${slugify(c.country)}`} className="rounded-[14px] p-4 transition-colors hover:brightness-[.98]" style={{ background: "var(--panel)" }}>
              <div className="flex items-center gap-2"><Flag country={c.country} /><span className="truncate text-sm font-medium">{c.country}</span></div>
              <div className="tnum mt-2 text-lg font-semibold">{eur(c.median)}</div>
              <div className="tnum text-[11px] text-ink-faint">{c.n} salaried</div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-14">
        <SectionHeader kicker="Explore" title="All tracked countries" />
        <div className="mt-5"><HubExplorer items={items} placeholder="Search a country…" unit="salaried" /></div>
      </section>

      <section className="mt-14">
        <SectionHeader kicker="By region" title="Browse by region" />
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {regionCounts.map((r) => (
            <div key={r.region} className="card">
              <span className="icon-chip"><Icon.globe size={15} /></span>
              <div className="mt-3 text-[15px] font-semibold">{r.region}</div>
              <div className="tnum mt-1 text-[13px] text-ink-faint">{r.n} countries tracked</div>
            </div>
          ))}
        </div>
      </section>

      <section className="section-y grid gap-5 md:grid-cols-2">
        <div className="card flex flex-col gap-3"><div className="flex items-center gap-2.5"><span className="icon-chip"><Icon.pin size={15} /></span><span className="text-[15px] font-semibold">Explore cities</span></div><p className="text-[14px] text-ink-muted">Drill into individual tech hubs across Europe.</p><div className="mt-1"><PillButton href="/locations">All cities</PillButton></div></div>
        <div className="card flex flex-col gap-3"><div className="flex items-center gap-2.5"><span className="icon-chip"><Icon.trophy size={15} /></span><span className="text-[15px] font-semibold">Country leaderboard</span></div><p className="text-[14px] text-ink-muted">See the full ranking by median base and transparency.</p><div className="mt-1"><PillButton href="/leaderboards#countries">View leaderboard</PillButton></div></div>
      </section>
    </div>
  );
}
