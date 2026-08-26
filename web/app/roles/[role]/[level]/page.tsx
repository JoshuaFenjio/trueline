import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getRoleLevelHub, roleFromSlug, getRoleFamilies } from "@/lib/data";
import { LEVELS, levelSlug, levelFromSlug } from "@/lib/levels";
import { RankTable, toPayVMs, Breadcrumbs, PillButton, GatedState } from "@/components/blocks";
import { MeasureBar } from "@/components/MeasureBar";
import { DensityCurve } from "@/components/DensityCurve";
import { Flag } from "@/components/Flag";
import { Icon } from "@/components/icons";
import { roleIconName } from "@/lib/roleBlurbs";
import { eur, eurK, slugify } from "@/lib/format";

export const revalidate = 3600;
export const dynamicParams = true;

// Pre-render every family × level. Thin combinations still build — they render
// the honest empty state, not an invented number.
export async function generateStaticParams() {
  const roles = await getRoleFamilies();
  return roles.flatMap((r) => LEVELS.map((l) => ({ role: slugify(r), level: levelSlug(l) })));
}

export async function generateMetadata({ params }: { params: { role: string; level: string } }): Promise<Metadata> {
  const role = await roleFromSlug(params.role);
  const level = levelFromSlug(params.level);
  if (!role || !level) return { title: "Role not found" };
  const hub = await getRoleLevelHub(role, level);
  const med = hub.overall.spread ? eur(hub.overall.spread.median) : "live data";
  const title = `${level} ${role} salary in Europe 2026, live from job boards`;
  return {
    title,
    description: `What ${level.toLowerCase()} ${role}s earn across EMEA: median ${med} base, by country and company. Real advertised salaries, gated at 8 postings.`,
    openGraph: {
      title,
      images: [`/og?kicker=${encodeURIComponent(level + " · " + role)}&title=${encodeURIComponent(level + " " + role)}&value=${encodeURIComponent(hub.overall.spread ? "Median " + med : "Live from job boards")}`],
    },
  };
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="card">
      <div className="flex items-center gap-2 text-[12px] text-ink-faint"><span className="text-[var(--accent)]">{icon}</span>{label}</div>
      <div className="tnum mt-2 text-2xl font-semibold">{value}</div>
      {sub && <div className="tnum mt-1 text-[12px] text-ink-faint">{sub}</div>}
    </div>
  );
}

// The level switcher — every band, current one highlighted, gated ones dimmed
// but still linked (they lead to their own honest empty state).
function LevelSwitch({ role, current, siblings }: {
  role: string; current: string;
  siblings: { level: string; median: number | null; n: number; gated: boolean }[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {siblings.map((s) => {
        const active = s.level === current;
        return (
          <Link
            key={s.level}
            href={`/roles/${slugify(role)}/${levelSlug(s.level as any)}`}
            className={`rounded-full border px-3.5 py-1.5 text-[13px] transition-colors ${active ? "border-[var(--accent)] text-ink" : "text-ink-muted hover:border-[var(--border-strong)] hover:text-ink"}`}
            style={{ background: active ? "var(--accent-soft)" : "var(--surface-1)" }}
          >
            {s.level}
            <span className="tnum ml-2 text-ink-faint">{s.median != null ? eurK(s.median) : `${s.n}·thin`}</span>
          </Link>
        );
      })}
    </div>
  );
}

export default async function RoleLevelPage({ params }: { params: { role: string; level: string } }) {
  const role = await roleFromSlug(params.role);
  const level = levelFromSlug(params.level);
  if (!role || !level) notFound();

  const hub = await getRoleLevelHub(role, level);
  const sp = hub.overall.spread;
  const RoleIcon = (Icon as any)[roleIconName(role)] ?? Icon.briefcase;
  // Sibling bands that DO clear the gate — surfaced in the empty state so a thin
  // page still points somewhere useful.
  const liveSiblings = hub.siblings.filter((s) => s.level !== level && s.median != null);

  return (
    <div className="pb-4">
      <div className="pt-8">
        <Breadcrumbs items={[{ label: "Salaries", href: "/roles" }, { label: role, href: `/roles/${slugify(role)}` }, { label: level }]} />
      </div>

      {/* Header */}
      <header className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}><RoleIcon size={22} /></span>
            <h1 className="t-h2">{level} {role}</h1>
          </div>
          <p className="mt-3 max-w-xl text-ink-muted">
            Advertised base pay for {level.toLowerCase()} {role} roles across EMEA, live from company job boards.
          </p>
        </div>
      </header>

      {/* Level switcher */}
      <section className="mt-6">
        <LevelSwitch role={role} current={level} siblings={hub.siblings} />
      </section>

      {!sp ? (
        /* Honest empty state — no invented number under the gate. */
        <section className="mt-8 space-y-4">
          <GatedState n={hub.overall.n} what={`${level} ${role} across EMEA`} tracked={hub.trackedN} />
          {liveSiblings.length > 0 && (
            <div className="card">
              <div className="flex items-center gap-2.5"><span className="icon-chip"><Icon.bars size={15} /></span><span className="text-[15px] font-semibold">Levels we can show for {role}</span></div>
              <ol className="mt-4">
                {liveSiblings.map((s) => (
                  <li key={s.level} className="border-t first:border-t-0" style={{ borderColor: "var(--border)" }}>
                    <Link href={`/roles/${slugify(role)}/${levelSlug(s.level)}`} className="flex h-10 items-center gap-3 transition-colors hover:bg-[var(--band)]">
                      <span className="flex-1 text-sm">{s.level} {role}</span>
                      <span className="tnum text-sm text-ink-faint">{s.n} salaried</span>
                      <span className="tnum text-sm font-semibold">{eur(s.median!)}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
          )}
          <div className="text-center">
            <PillButton href={`/roles/${slugify(role)}`}>See all {role} levels</PillButton>
          </div>
        </section>
      ) : (
        <>
          {/* Stat cards */}
          <section className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard icon={<Icon.bars size={15} />} label="Median base salary" value={eur(sp.median)} sub={`${hub.overall.n} salaried postings`} />
            <StatCard icon={<Icon.scale size={15} />} label="Middle 50% of postings" value={`${eurK(sp.p25)}–${eurK(sp.p75)}`} sub="P25 to P75" />
            <StatCard icon={<Icon.spark size={15} />} label="Top decile (P90)" value={eurK(sp.p90)} sub="Best-paid 10%" />
            <StatCard icon={<Icon.briefcase size={15} />} label="Roles tracked" value={hub.trackedN.toLocaleString()} sub={`${hub.disclosedN} disclose pay`} />
          </section>

          {/* Distribution */}
          <section className="mt-8">
            <div className="card">
              <div className="flex items-center gap-2.5"><span className="icon-chip"><Icon.spark size={15} /></span><span className="text-[15px] font-semibold">Salary distribution — {level} {role}</span></div>
              <div className="mt-4">
                {hub.dist.length >= 20 ? <DensityCurve values={hub.dist} spread={sp} /> : <MeasureBar spread={sp} />}
              </div>
              <p className="mt-2 text-[12px] text-ink-faint">{hub.dist.length >= 20 ? `Kernel-smoothed density of ${hub.overall.n} salaried postings.` : `From ${hub.overall.n} salaried postings.`}</p>
            </div>
          </section>

          {/* Countries + companies */}
          <section className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="card">
              <div className="flex items-center gap-2.5"><span className="icon-chip"><Icon.globe size={15} /></span><span className="text-[15px] font-semibold">Top paying countries</span></div>
              <ol className="mt-4">
                {hub.topCountries.length ? hub.topCountries.map((c, i) => (
                  <li key={c.slug} className="border-t first:border-t-0" style={{ borderColor: "var(--border)" }}>
                    <Link href={`/locations/country/${c.slug}`} className="flex h-10 items-center gap-3 transition-colors hover:bg-[var(--band)]">
                      <span className="tnum w-5 text-right text-sm text-ink-faint">{i + 1}</span>
                      <Flag country={c.label} /><span className="min-w-0 flex-1 truncate text-sm">{c.label}</span>
                      <span className="tnum text-sm font-semibold">{eur(c.value)}</span>
                    </Link>
                  </li>
                )) : <li className="py-4 text-sm text-ink-faint">No country clears the gate at this level yet.</li>}
              </ol>
            </div>
            <div className="card">
              <div className="flex items-center gap-2.5"><span className="icon-chip"><Icon.building size={15} /></span><span className="text-[15px] font-semibold">Top companies hiring</span></div>
              <div className="mt-4">{hub.topCompanies.length ? <RankTable rows={toPayVMs(hub.topCompanies, (s) => `/companies/${s}`)} /> : <p className="text-sm text-ink-faint">Needs 3+ postings per company at this level.</p>}</div>
            </div>
          </section>
        </>
      )}

      {/* CTA + parent role */}
      <section className="section-y grid grid-cols-1 gap-5 md:grid-cols-2">
        <div className="band-dark flex flex-col p-6">
          <span className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: "rgba(255,255,255,.12)" }}><Icon.users size={20} className="text-white" /></span>
          <h3 className="mt-4 text-xl font-bold text-white">Add your salary</h3>
          <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "rgba(255,255,255,.72)" }}>Anonymously sharpen the benchmark for {level.toLowerCase()} {role}s across Europe.</p>
          <div className="mt-auto pt-6"><Link href="/add" className="pill-btn pill-btn-light"><span>Add your salary</span><span className="arw">→</span></Link></div>
        </div>
        <div className="card flex flex-col">
          <div className="flex items-center gap-2.5"><span className="icon-chip"><Icon.target size={15} /></span><span className="text-[15px] font-semibold">All {role} levels</span></div>
          <p className="mt-3 text-[14px] leading-relaxed text-ink-muted">Compare {role} pay across every seniority band, plus cities, countries and companies.</p>
          <div className="mt-auto pt-6"><PillButton href={`/roles/${slugify(role)}`}>Open the {role} hub</PillButton></div>
        </div>
      </section>
    </div>
  );
}
