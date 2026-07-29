import Link from "next/link";
import {
  getLiveStats, getFilterOptions, getSectors, getLeaderboards, searchSalaries, isConfigured,
} from "@/lib/data";
import { SearchForm } from "@/components/SearchForm";
import { MeasureBar } from "@/components/MeasureBar";
import { Card, Pill, LiveDot, Stat, GhostLink } from "@/components/ui";
import { SectionHeader, Chip } from "@/components/blocks";
import { eur, eurK, slugify, pct } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: { role?: string; level?: string; city?: string; base?: string };
}) {
  if (!isConfigured) return <NotConfigured />;

  const [stats, options, sectors, lb] = await Promise.all([
    getLiveStats(), getFilterOptions(), getSectors(), getLeaderboards(),
  ]);
  const hasQuery = Boolean(searchParams.role || searchParams.city || searchParams.level || searchParams.base);
  const result = hasQuery
    ? await searchSalaries({
        role: searchParams.role, level: searchParams.level, city: searchParams.city,
        base: searchParams.base ? Number(searchParams.base) : undefined,
      })
    : null;

  return (
    <div className="pb-10">
      {/* Hero */}
      <section className="pt-14 text-center md:pt-20">
        <Pill className="mx-auto">
          <LiveDot />
          <span className="tnum text-ink-muted">
            {stats.salaried.toLocaleString()} salaried roles · {stats.companies} companies · {stats.cities} cities
          </span>
        </Pill>
        <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-extrabold leading-[1.06] tracking-tight md:text-6xl">
          Know what Europe actually pays <span className="serif-accent gradient-text font-normal">you.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base text-ink-muted md:text-lg">
          Real base-salary benchmarks from live job postings across EMEA — by role, level and city.
          No surveys, no guesses, honest sample sizes.
        </p>
      </section>

      {/* Search */}
      <section className="mx-auto mt-9 max-w-4xl">
        <SearchForm roles={options.roles} cities={options.cities} current={searchParams} />
      </section>

      {/* Results */}
      <section id="results" className="mx-auto mt-8 max-w-4xl scroll-mt-20">
        {result === null ? null : !result.enough ? <NotEnough result={result} /> : <Results result={result} />}
      </section>

      {/* Browse tiles */}
      <section className="mt-24">
        <SectionHeader kicker="Browse" title="Explore the whole" accent="market." />
        <div className="mt-7 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <BrowseTile title="Sectors" href="/leaderboards#by-sector">
            {sectors.slice(0, 6).map((s) => (
              <Chip key={s} href={`/leaderboards?sector=${encodeURIComponent(s)}#by-sector`}>{s}</Chip>
            ))}
          </BrowseTile>
          <BrowseTile title="Roles" href={options.roles[0] ? `/roles/${slugify(options.roles[0])}` : "/leaderboards#by-role"}>
            {options.roles.slice(0, 6).map((r) => (
              <Chip key={r} href={`/roles/${slugify(r)}`}>{r}</Chip>
            ))}
          </BrowseTile>
          <BrowseTile title="Cities" href="/leaderboards#countries">
            {options.cities.slice(0, 6).map((c) => (
              <Chip key={c.key} href={`/locations/${slugify(c.label)}`}>{c.label}</Chip>
            ))}
          </BrowseTile>
          <Link href="/leaderboards" className="group">
            <Card className="surface-hover flex h-full flex-col justify-between transition-colors">
              <div>
                <div className="tnum text-[11px] uppercase tracking-[0.22em] text-ink-faint">Leaderboards</div>
                <div className="mt-2 text-2xl font-extrabold tracking-tight">Who pays <span className="serif-accent gradient-text font-normal">most.</span></div>
                <p className="mt-2 text-sm text-ink-muted">Top payers overall, by sector, role and country — plus the most transparent employers.</p>
              </div>
              <div className="mt-4 text-sm text-brand-2">Open leaderboards →</div>
            </Card>
          </Link>
        </div>
      </section>

      {/* Most transparent this week */}
      {lb.bestDisclosure.length > 0 && (
        <section className="mt-20">
          <div className="flex items-center justify-between">
            <SectionHeader kicker="Transparency" title="Most transparent companies" />
            <Link href="/leaderboards#transparent" className="hidden text-sm text-ink-muted hover:text-ink md:block">See all →</Link>
          </div>
          <div className="mt-6 flex gap-3 overflow-x-auto pb-2">
            {lb.bestDisclosure.slice(0, 10).map((d) => (
              <Link key={d.slug} href={`/companies/${d.slug}`} className="shrink-0">
                <div className="surface surface-hover flex items-center gap-3 rounded-2xl px-4 py-3 transition-colors">
                  <span className="tnum text-lg font-semibold" style={{ color: "var(--mint)" }}>{pct(d.pct)}</span>
                  <span className="whitespace-nowrap text-sm">{d.company}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function BrowseTile({ title, href, children }: { title: string; href: string; children: React.ReactNode }) {
  return (
    <Card className="flex h-full flex-col">
      <div className="flex items-center justify-between">
        <div className="tnum text-[11px] uppercase tracking-[0.22em] text-ink-faint">{title}</div>
        <Link href={href} className="text-xs text-ink-muted hover:text-ink">all →</Link>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">{children}</div>
    </Card>
  );
}

function Results({ result }: { result: Awaited<ReturnType<typeof searchSalaries>> }) {
  const sp = result.spread!;
  const you = result.base;
  const below = result.baseDelta != null && result.baseDelta < 0;
  const tone = below ? "var(--ember)" : "var(--mint)";

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-medium">
            {result.role === "Any" ? "All roles" : result.role}
            {result.level !== "Any" && <span className="text-ink-muted"> · {result.level}</span>}
            <span className="text-ink-muted"> · {result.city}</span>
          </h2>
          <div className="tnum text-sm text-ink-faint">n = {result.n}</div>
        </div>
        <div className="mt-2 flex items-end gap-3">
          <div className="tnum text-4xl font-semibold md:text-5xl">{eur(sp.median)}</div>
          <div className="pb-1 text-sm text-ink-faint">median base / year</div>
        </div>
        <MeasureBar spread={sp} you={you} />
        {you != null && result.baseDelta != null ? (
          <p className="text-center text-base">
            You&apos;re{" "}
            <span className="tnum font-semibold" style={{ color: tone }}>{eur(Math.abs(result.baseDelta))} {below ? "below" : "above"}</span>{" "}
            the median — around the <span className="tnum font-semibold">{ordinal(result.basePercentile!)}</span> percentile.
          </p>
        ) : (
          <p className="text-center text-ink-muted">
            Half of these roles advertise between <span className="tnum text-ink">{eurK(sp.p25)}</span> and <span className="tnum text-ink">{eurK(sp.p75)}</span>.
          </p>
        )}
      </Card>

      <Card>
        <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
          <Stat label="Postings analysed" value={<span className="tnum">{result.advertisedN}</span>} />
          <Stat label="Advertised · verified" value={<span className="tnum">{result.advertisedN} · {result.verifiedN}</span>} />
          <Stat label="Middle 50%" value={<span className="tnum">{eurK(sp.p25)}–{eurK(sp.p75)}</span>} />
          <Stat label="P10 → P90" value={<span className="tnum">{eurK(sp.p10)}–{eurK(sp.p90)}</span>} />
        </div>
      </Card>

      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <h3 className="text-sm font-medium text-ink-muted">Top payers <span className="text-ink-faint">· {result.role === "Any" ? "all roles" : result.role}</span></h3>
          <ul className="mt-3 space-y-1.5">
            {result.topPayers.map((c) => (
              <li key={c.slug}>
                <Link href={`/companies/${c.slug}`} className="surface-hover flex items-center justify-between rounded-xl border px-3 py-2.5 transition-colors">
                  <span>{c.company}</span>
                  <span className="tnum text-ink">{eur(c.midpoint)} <span className="text-ink-faint">· {c.n}</span></span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <h3 className="text-sm font-medium text-ink-muted">Same role, other cities</h3>
          <ul className="mt-3 space-y-1.5">
            {result.acrossCities.map((c) => (
              <li key={c.cityKey}>
                <Link href={`/locations/${slugify(c.city)}`} className="surface-hover flex items-center justify-between rounded-xl border px-3 py-2.5 transition-colors">
                  <span>{c.city}</span>
                  <span className="tnum text-ink">{eur(c.median)} <span className="text-ink-faint">· {c.n}</span></span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function NotEnough({ result }: { result: Awaited<ReturnType<typeof searchSalaries>> }) {
  const pctv = Math.min(100, (result.n / 8) * 100);
  return (
    <Card className="text-center">
      <div className="tnum text-[11px] uppercase tracking-[0.22em] text-ink-faint">Gated · sample too small</div>
      <h2 className="mt-2 text-2xl font-extrabold tracking-tight">Not enough recent data <span className="serif-accent gradient-text font-normal">yet.</span></h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">
        We track <span className="tnum text-ink">{result.n}</span> salaried posting{result.n === 1 ? "" : "s"} for{" "}
        {result.role === "Any" ? "this search" : result.role}{result.city !== "Europe" ? ` in ${result.city}` : ""}. The median unlocks at <span className="tnum text-ink">8</span>.
      </p>
      <div className="mx-auto mt-5 h-2 max-w-xs overflow-hidden rounded-full" style={{ background: "var(--surface-3)" }}>
        <div className="h-full rounded-full gradient-bg" style={{ width: `${pctv}%` }} />
      </div>
      <div className="mt-5 flex justify-center gap-3">
        <GhostLink href="/#results">Broaden search</GhostLink>
        <GhostLink href="/add">Add your salary</GhostLink>
      </div>
    </Card>
  );
}

function NotConfigured() {
  return (
    <div className="py-24 text-center">
      <h1 className="text-2xl font-semibold">Trueline</h1>
      <p className="mx-auto mt-3 max-w-md text-ink-muted">
        Supabase isn&apos;t configured. Set <code className="tnum">SUPABASE_URL</code> and <code className="tnum">SUPABASE_ANON_KEY</code> in <code className="tnum">web/.env.local</code>.
      </p>
    </div>
  );
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
