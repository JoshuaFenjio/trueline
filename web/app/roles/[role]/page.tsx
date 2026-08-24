import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getRoleHub, roleFromSlug, getRoleFamilies, getLastRefreshed } from "@/lib/data";
import { SectionHeader, RankTable, toPayVMs, LevelLadder, TrendBadge, GatedState, Breadcrumbs, PillButton } from "@/components/blocks";
import { MeasureBar } from "@/components/MeasureBar";
import { DensityCurve } from "@/components/DensityCurve";
import { ShareButton } from "@/components/ShareButton";
import { Flag } from "@/components/Flag";
import { Icon } from "@/components/icons";
import { roleBlurb, roleIconName } from "@/lib/roleBlurbs";
import { eur, eurK, slugify, timeAgo } from "@/lib/format";

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

const CATEGORY: Record<string, string> = {
  "Software Engineer": "Engineering", Backend: "Engineering", Frontend: "Engineering", Mobile: "Engineering",
  "DevOps/Platform": "Engineering", "QA/Test": "Engineering", "Engineering Manager": "Engineering", "Security Engineer": "Engineering",
  "Data Engineer": "Data", "Data Scientist": "Data", "Data Analyst": "Data", "ML/AI Engineer": "Data",
  "Product Manager": "Product", Designer: "Design", "Sales/AE": "Go-to-market", Marketing: "Go-to-market",
  "Customer Success": "Go-to-market", Operations: "Operations", Finance: "Operations", Legal: "Operations", "People/HR": "Operations",
};

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="card">
      <div className="flex items-center gap-2 text-[12px] text-ink-faint"><span className="text-[var(--accent)]">{icon}</span>{label}</div>
      <div className="tnum mt-2 text-2xl font-semibold">{value}</div>
      {sub && <div className="tnum mt-1 text-[12px] text-ink-faint">{sub}</div>}
    </div>
  );
}

export default async function RolePage({ params }: { params: { role: string } }) {
  const role = await roleFromSlug(params.role);
  if (!role) notFound();
  const [hub, allRoles, refreshed] = await Promise.all([getRoleHub(role), getRoleFamilies(), getLastRefreshed()]);
  const adjacent = allRoles.filter((r) => r !== role).slice(0, 10);
  const sp = hub.overall.spread;
  const RoleIcon = (Icon as any)[roleIconName(role)] ?? Icon.briefcase;
  const showDemand = hub.trend.dir === "up" || hub.trend.dir === "down" || hub.trend.dir === "flat";

  return (
    <div className="pb-4">
      <div className="pt-8"><Breadcrumbs items={[{ label: "Salaries", href: "/roles" }, { label: "Roles", href: "/roles" }, { label: role }]} /></div>

      {/* Header */}
      <header className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}><RoleIcon size={22} /></span>
            <h1 className="t-h2">{role}</h1>
          </div>
          <p className="mt-3 max-w-xl text-ink-muted">{roleBlurb(role)}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full border px-3 py-1 text-[12px] text-ink-muted" style={{ background: "var(--surface-1)" }}>{CATEGORY[role] ?? "Role family"}</span>
            <span className="rounded-full border px-3 py-1 text-[12px] text-ink-muted" style={{ background: "var(--surface-1)" }}>EMEA</span>
            <span className="rounded-full border px-3 py-1 text-[12px] text-ink-muted" style={{ background: "var(--surface-1)" }}>Advertised base</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <TrendBadge trend={hub.trend} />
          <ShareButton />
        </div>
      </header>

      {!sp ? (
        <section className="mt-8"><GatedState n={hub.overall.n} what={`${role} across EMEA`} tracked={hub.trackedN} /></section>
      ) : (
        <>
          {/* Stat cards */}
          <section className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard icon={<Icon.bars size={15} />} label="Median base salary" value={eur(sp.median)} sub={`${hub.overall.n} salaried postings`} />
            <StatCard icon={<Icon.scale size={15} />} label="Middle 50% of postings" value={`${eurK(sp.p25)}–${eurK(sp.p75)}`} sub="P25 to P75" />
            <StatCard icon={<Icon.briefcase size={15} />} label="Roles tracked" value={hub.trackedN.toLocaleString()} sub={`${hub.disclosedN} disclose pay`} />
            <StatCard icon={<Icon.refresh size={15} />} label="Data freshness" value={<span className="text-xl">{timeAgo(refreshed)}</span>} sub="Re-scraped 6-hourly" />
          </section>

          {/* Distribution curve + by-level */}
          <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.1fr]">
            <div className="card">
              <div className="flex items-center gap-2.5"><span className="icon-chip"><Icon.bars size={15} /></span><span className="text-[15px] font-semibold">Salary by experience level</span></div>
              <div className="mt-5"><LevelLadder items={hub.byLevel.map((b) => ({ level: b.level, median: b.slice.spread?.median ?? null, n: b.slice.n }))} /></div>
            </div>
            <div className="card">
              <div className="flex items-center gap-2.5"><span className="icon-chip"><Icon.spark size={15} /></span><span className="text-[15px] font-semibold">Salary distribution</span></div>
              <div className="mt-4">
                {hub.dist.length >= 20
                  ? <DensityCurve values={hub.dist} spread={sp} />
                  : <MeasureBar spread={sp} />}
              </div>
              <p className="mt-2 text-[12px] text-ink-faint">{hub.dist.length >= 20 ? `Kernel-smoothed density of ${hub.overall.n} salaried postings.` : `From ${hub.overall.n} salaried postings.`}</p>
            </div>
          </section>

          {/* Three-column */}
          <section className="mt-8 grid gap-6 lg:grid-cols-3">
            <div className="card">
              <div className="flex items-center gap-2.5"><span className="icon-chip"><Icon.pin size={15} /></span><span className="text-[15px] font-semibold">Top paying cities</span></div>
              <div className="mt-4">{hub.topCities.length ? <RankTable rows={toPayVMs(hub.topCities, (s) => `/locations/${s}`)} /> : <p className="text-sm text-ink-faint">No city clears the gate yet.</p>}</div>
            </div>
            <div className="card">
              <div className="flex items-center gap-2.5"><span className="icon-chip"><Icon.globe size={15} /></span><span className="text-[15px] font-semibold">Top paying countries</span></div>
              <ol className="mt-4">
                {hub.topCountries.length ? hub.topCountries.map((c, i) => (
                  <li key={c.slug} className="border-t first:border-t-0" style={{ borderColor: "var(--border)" }}>
                    <Link href={`/locations/country/${c.slug}`} className="flex h-10 items-center gap-3 transition-colors hover:bg-[var(--band)]">
                      <span className="tnum w-5 text-right text-sm text-ink-faint">{i + 1}</span>
                      <Flag country={c.label} /><span className="flex-1 truncate text-sm">{c.label}</span>
                      <span className="tnum text-sm font-semibold">{eur(c.value)}</span>
                    </Link>
                  </li>
                )) : <li className="py-4 text-sm text-ink-faint">No country clears the gate yet.</li>}
              </ol>
            </div>
            <div className="card">
              <div className="flex items-center gap-2.5"><span className="icon-chip"><Icon.building size={15} /></span><span className="text-[15px] font-semibold">Top companies hiring</span></div>
              <div className="mt-4">{hub.topCompanies.length ? <RankTable rows={toPayVMs(hub.topCompanies, (s) => `/companies/${s}`)} /> : <p className="text-sm text-ink-faint">Needs 3+ postings per company.</p>}</div>
            </div>
          </section>

          {/* Job-demand insight — only when a real trend computes */}
          {showDemand && (
            <section className="mt-8">
              <div className="card flex flex-wrap items-center gap-4">
                <span className="icon-chip"><Icon.trending size={15} /></span>
                <div className="flex-1">
                  <div className="text-[15px] font-semibold">Hiring demand</div>
                  <p className="text-[13px] text-ink-muted">Recent 90-day posting activity for {role}, versus the prior 90 days.</p>
                </div>
                <TrendBadge trend={hub.trend} />
              </div>
            </section>
          )}
        </>
      )}

      {/* Adjacent roles */}
      <section className="mt-8">
        <SectionHeader kicker="Related" title="Adjacent roles" />
        <div className="mt-4 flex flex-wrap gap-2">
          {adjacent.map((r) => (
            <Link key={r} href={`/roles/${slugify(r)}`} className="rounded-full border px-3 py-1.5 text-[13px] text-ink-muted transition-colors hover:border-[var(--border-strong)] hover:text-ink" style={{ background: "var(--surface-1)" }}>{r}</Link>
          ))}
        </div>
      </section>

      {/* CTA + methodology */}
      <section className="section-y grid gap-5 md:grid-cols-2">
        <div className="band-dark flex flex-col p-6">
          <span className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: "rgba(255,255,255,.12)" }}><Icon.users size={20} className="text-white" /></span>
          <h3 className="mt-4 text-xl font-bold text-white">Add your salary</h3>
          <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "rgba(255,255,255,.72)" }}>Anonymously sharpen the benchmark for {role}s across Europe.</p>
          <div className="mt-auto pt-6"><Link href="/add" className="pill-btn pill-btn-light"><span>Add your salary</span><span className="arw">→</span></Link></div>
        </div>
        <div className="card flex flex-col">
          <div className="flex items-center gap-2.5"><span className="icon-chip"><Icon.doc size={15} /></span><span className="text-[15px] font-semibold">How we calculate</span></div>
          <p className="mt-3 text-[14px] leading-relaxed text-ink-muted">Every figure is the median of advertised base salaries from live job postings, gated at 8 postings, currency-normalised, city-anchored. No guessed bonus or equity.</p>
          <div className="mt-auto pt-6"><PillButton href="/methodology">Read the methodology</PillButton></div>
        </div>
      </section>
    </div>
  );
}
