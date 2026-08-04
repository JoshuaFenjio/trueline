import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getRoleHub, roleFromSlug } from "@/lib/data";
import { SectionHeader, RankTable, toPayVMs, LevelLadder, TrendBadge, GatedState } from "@/components/blocks";
import { MeasureBar } from "@/components/MeasureBar";
import { Card } from "@/components/ui";
import { eur, slugify } from "@/lib/format";

export const revalidate = 3600;
export const dynamicParams = true;

export async function generateMetadata({ params }: { params: { role: string } }): Promise<Metadata> {
  const role = await roleFromSlug(params.role);
  if (!role) return { title: "Role not found" };
  const hub = await getRoleHub(role);
  const med = hub.overall.spread ? eur(hub.overall.spread.median) : "live data";
  const title = `${role} salary in Europe 2026, live from company job boards`;
  return {
    title,
    description: `What ${role}s earn across EMEA: median ${med} base, by level, city, country and company. Real advertised salaries from live job boards.`,
    openGraph: {
      title,
      images: [`/og?kicker=${encodeURIComponent(role + " · EMEA")}&title=${encodeURIComponent(role + " salaries")}&value=${encodeURIComponent(hub.overall.spread ? "Median " + med : "Live from job boards")}`],
    },
  };
}

export default async function RolePage({ params }: { params: { role: string } }) {
  const role = await roleFromSlug(params.role);
  if (!role) notFound();
  const hub = await getRoleHub(role);

  return (
    <div className="py-14">
      <div className="tnum text-xs text-ink-faint">
        <Link href="/leaderboards" className="hover:text-ink">Leaderboards</Link> / Role
      </div>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <SectionHeader kicker={`Role · EMEA · ${hub.overall.n} salaried ads`} title={role} accent="pay." />
        <div className="flex items-center gap-3">
          {hub.overall.spread && <div className="tnum text-3xl font-semibold">{eur(hub.overall.spread.median)}</div>}
          <TrendBadge trend={hub.trend} />
        </div>
      </div>

      {/* Spread */}
      <section className="mt-8">
        {hub.overall.spread ? (
          <Card>
            <div className="text-sm text-ink-muted">Advertised base across all levels · median <span className="tnum text-ink">{eur(hub.overall.spread.median)}</span></div>
            <MeasureBar spread={hub.overall.spread} />
          </Card>
        ) : (
          <GatedState n={hub.overall.n} what={`${role} across EMEA`} tracked={hub.trackedN} />
        )}
      </section>

      {/* Ladder by level */}
      <section className="mt-16">
        <SectionHeader kicker="By level" title="The pay ladder" sub="Median base by seniority. Bars unlock at 8 postings." />
        <div className="mt-6 max-w-2xl">
          <LevelLadder items={hub.byLevel.map((b) => ({ level: b.level, median: b.slice.spread?.median ?? null, n: b.slice.n }))} />
        </div>
      </section>

      {/* Cities + Countries */}
      <div className="mt-16 grid gap-12 md:grid-cols-2">
        <section>
          <SectionHeader kicker="By city" title="Top cities" />
          <div className="mt-5">
            {hub.topCities.length ? <RankTable rows={toPayVMs(hub.topCities, (s) => `/locations/${s}`)} />
              : <p className="text-sm text-ink-faint">No city clears the 8-posting gate yet.</p>}
          </div>
        </section>
        <section>
          <SectionHeader kicker="By country" title="Top countries" />
          <div className="mt-5">
            {hub.topCountries.length ? <RankTable rows={toPayVMs(hub.topCountries, (s) => `/locations/country/${s}`)} />
              : <p className="text-sm text-ink-faint">No country clears the 8-posting gate yet.</p>}
          </div>
        </section>
      </div>

      {/* Top companies */}
      <section className="mt-16">
        <SectionHeader kicker="By company" title="Who pays this role most" />
        <div className="mt-5">
          {hub.topCompanies.length ? <RankTable rows={toPayVMs(hub.topCompanies, (s) => `/companies/${s}`)} />
            : <p className="text-sm text-ink-faint">Not enough per-company data yet (3+ postings needed).</p>}
        </div>
      </section>
    </div>
  );
}
