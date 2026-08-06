import type { Metadata } from "next";
import { getRoleIndex, getLiveStats, isConfigured } from "@/lib/data";
import { SectionHeader, RankTable, toPayVMs, toVolumeVMs, Breadcrumbs, StatStrip } from "@/components/blocks";
import { SubNav } from "@/components/SubNav";
import { eur } from "@/lib/format";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Salaries by role in Europe",
  description: "Median advertised base pay for every tech role we track across EMEA, ranked, from live company job postings.",
};

const SALARIES_NAV = [
  { label: "Roles", href: "/roles" },
  { label: "Cities", href: "/locations" },
  { label: "Countries", href: "/locations/countries" },
];

export default async function RolesIndex() {
  if (!isConfigured) return <p className="py-24 text-center text-ink-muted">Supabase not configured.</p>;
  const [roles, stats] = await Promise.all([getRoleIndex(), getLiveStats()]);

  const ranked = roles.filter((r) => r.median != null);
  const byVolume = [...roles].sort((a, b) => b.n - a.n).slice(0, 12);
  const topMedian = ranked[0];

  return (
    <div className="py-12">
      <Breadcrumbs items={[{ label: "Salaries", href: "/roles" }, { label: "Roles" }]} />
      <div className="mt-4"><SubNav items={SALARIES_NAV} /></div>

      <SectionHeader kicker="Salaries · by role" title="What each role pays" sub="Median advertised base across EMEA, live from company job boards. Medians unlock at 8 postings." />

      <div className="mt-7">
        <StatStrip
          items={[
            { value: roles.length, label: "Roles tracked" },
            { value: topMedian ? eur(topMedian.median!) : "—", label: topMedian ? `Top: ${topMedian.name}` : "Top median" },
            { value: stats.salaried.toLocaleString(), label: "Salaried ads" },
            { value: byVolume[0]?.name ?? "—", label: "Most in demand" },
          ]}
        />
      </div>

      <section className="mt-14">
        <SectionHeader kicker="Ranked" title="Highest-paying roles" />
        <div className="mt-5">
          {ranked.length
            ? <RankTable rows={toPayVMs(ranked.map((r) => ({ label: r.name, slug: r.slug, value: r.median!, n: r.n })), (s) => `/roles/${s}`)} />
            : <p className="text-sm text-ink-faint">No role clears the 8-posting gate yet.</p>}
        </div>
      </section>

      <section className="mt-16">
        <SectionHeader kicker="Demand" title="Most in-demand roles" sub="By number of salaried postings we currently track." />
        <div className="mt-5">
          <RankTable rows={toVolumeVMs(byVolume, (s) => `/roles/${s}`)} valueHead="Postings" />
        </div>
      </section>
    </div>
  );
}
