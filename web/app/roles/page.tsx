import type { Metadata } from "next";
import Link from "next/link";
import { getRoleIndex, getRoleActivity, getLiveStats, getSectorCounts, getCountryLeaderboard, isConfigured } from "@/lib/data";
import { SectionHeader, RankTable, toPayVMs, toVolumeVMs, Breadcrumbs, PillButton } from "@/components/blocks";
import { HubExplorer, HubItem } from "@/components/HubExplorer";
import { Icon } from "@/components/icons";
import { eur } from "@/lib/format";
import { familyLabel } from "@/lib/roleNames";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Salaries by role in Europe",
  description: "Median advertised base pay for every tech role we track across EMEA, ranked, from live company job postings.",
};

export default async function RolesIndex() {
  if (!isConfigured) return <p className="py-24 text-center text-ink-muted">Supabase not configured.</p>;
  const [roles, activity, stats, sectors, countries] = await Promise.all([
    getRoleIndex(), getRoleActivity(), getLiveStats(), getSectorCounts(), getCountryLeaderboard(),
  ]);

  // "Other" is the residual bucket for ads we couldn't classify — counting it
  // as a role family would make "45 role families benchmarked" a claim we can't
  // stand behind. Excluded from every count and ranking on this hub.
  const families = roles.filter((r) => r.name !== "Other");
  const ranked = families.filter((r) => r.median != null);
  const byVolume = [...families].sort((a, b) => b.n - a.n).slice(0, 10);
  const topMedian = ranked[0];
  const floating = ranked.slice(0, 4);
  const mostActive = activity.slice(0, 8);
  const items: HubItem[] = ranked.map((r) => ({ name: familyLabel(r.name), slug: r.slug, median: r.median!, n: r.n, flagCountry: null, href: `/roles/${r.slug}` }));
  const topSectors = sectors.filter((s) => s.sector !== "Other");

  return (
    <div className="pb-4">
      <div className="pt-8"><Breadcrumbs items={[{ label: "Salaries", href: "/roles" }, { label: "Roles" }]} /></div>

      {/* Hero */}
      <section className="mt-6 grid grid-cols-1 items-center gap-8 lg:grid-cols-[1fr_.9fr]">
        <div>
          <span className="eyebrow-pill"><span className="eyebrow">{ranked.length} role families benchmarked</span></span>
          <h1 className="t-h1 mt-5">Explore roles.<br /><span className="accent-italic">Benchmark pay.</span></h1>
          <p className="mt-4 max-w-lg text-lg leading-relaxed text-ink-muted">Median advertised base for every tech role we track across EMEA, live from company job boards. A median needs 8 salaried job ads.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {floating.map((r) => (
            <Link key={r.slug} href={`/roles/${r.slug}`} className="card-float card-hover p-4">
              <div className="truncate text-[13px] font-medium">{familyLabel(r.name)}</div>
              <div className="tnum mt-2 text-lg font-semibold">{eur(r.median!)}</div>
              <div className="tnum text-[11px] text-ink-faint">median · {r.n} salaried ads</div>
            </Link>
          ))}
        </div>
      </section>

      {/* Category chips */}
      <div className="mt-8 flex flex-wrap gap-2">
        {topSectors.map((s) => (
          <Link key={s.sector} href={`/companies?sector=${encodeURIComponent(s.sector)}`} className="pill-btn"><span>{s.sector}</span><span className="tnum text-ink-faint">{s.n}</span></Link>
        ))}
      </div>

      {/* Stat band */}
      <section className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { icon: Icon.bars, v: stats.salaried.toLocaleString(), l: "Salaried job ads tracked" },
          { icon: Icon.briefcase, v: ranked.length, l: "Role families benchmarked" },
          { icon: Icon.globe, v: countries.length, l: "Countries with a published median" },
          { icon: Icon.trophy, v: topMedian ? familyLabel(topMedian.name) : "—", l: topMedian ? `Top-paying role family · ${eur(topMedian.median!)} median` : "Top-paying role family" },
        ].map((s, i) => (
          <div key={i} className="card"><div className="flex items-center gap-2 text-[12px] text-ink-faint"><span className="text-[var(--accent)]"><s.icon size={15} /></span>{s.l}</div><div className="tnum mt-2 truncate text-xl font-semibold">{s.v}</div></div>
        ))}
      </section>

      {/* Most active */}
      {mostActive.length > 0 && (
        <section className="mt-12">
          <SectionHeader kicker="Momentum" title="Most active role families" sub="Ranked by new job ads in the last 30 days." />
          <div className="mt-5 flex flex-wrap gap-2">
            {mostActive.map((r) => (
              <Link key={r.slug} href={`/roles/${r.slug}`} className="pill-btn"><Icon.trending size={14} /><span>{familyLabel(r.role)}</span><span className="tnum text-ink-faint">{r.recentN}</span></Link>
            ))}
          </div>
        </section>
      )}

      {/* Top by median + volume */}
      <section className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card">
          <div className="flex items-center gap-2.5"><span className="icon-chip"><Icon.trophy size={15} /></span><span className="text-[15px] font-semibold">Highest-paying role families</span></div>
          <div className="mt-4">{ranked.length ? <RankTable rows={toPayVMs(ranked.slice(0, 10).map((r) => ({ label: familyLabel(r.name), slug: r.slug, value: r.median!, n: r.n })), (s) => `/roles/${s}`)} /> : <p className="text-sm text-ink-faint">No role family clears the 8-ad gate yet.</p>}</div>
        </div>
        <div className="card">
          <div className="flex items-center gap-2.5"><span className="icon-chip"><Icon.users size={15} /></span><span className="text-[15px] font-semibold">Most in demand</span></div>
          <div className="mt-4"><RankTable rows={toVolumeVMs(byVolume.map((r) => ({ ...r, name: familyLabel(r.name) })), (s) => `/roles/${s}`, "")} valueHead="Live job ads" /></div>
        </div>
      </section>

      {/* Explore */}
      <section className="mt-14">
        <SectionHeader kicker="Explore" title="All benchmarked role families" />
        <div className="mt-5"><HubExplorer items={items} placeholder="Search a role family…" unit="salaried ads" /></div>
      </section>

      {/* CTA */}
      <section className="section-y grid grid-cols-1 gap-5 md:grid-cols-2">
        <div className="card flex flex-col gap-3"><div className="flex items-center gap-2.5"><span className="icon-chip"><Icon.scale size={15} /></span><span className="text-[15px] font-semibold">Compare companies</span></div><p className="text-[14px] text-ink-muted">See who pays a given role the most across employers.</p><div className="mt-1"><PillButton href="/leaderboards#by-role">By-role leaderboard</PillButton></div></div>
        <div className="card flex flex-col gap-3"><div className="flex items-center gap-2.5"><span className="icon-chip"><Icon.users size={15} /></span><span className="text-[15px] font-semibold">Add your salary</span></div><p className="text-[14px] text-ink-muted">Help sharpen role benchmarks — anonymously, in a minute.</p><div className="mt-1"><PillButton href="/add">Add your salary</PillButton></div></div>
      </section>
    </div>
  );
}
