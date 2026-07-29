import Link from "next/link";
import { getLiveStats, getFilterOptions, searchSalaries, isConfigured } from "@/lib/data";
import { SearchForm } from "@/components/SearchForm";
import { MeasureBar } from "@/components/MeasureBar";
import { Card, Pill, LiveDot, Stat, GhostLink } from "@/components/ui";
import { eur, eurK, slugify } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: { role?: string; level?: string; city?: string; base?: string };
}) {
  if (!isConfigured) return <NotConfigured />;

  const [stats, options] = await Promise.all([getLiveStats(), getFilterOptions()]);
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
      <section className="pt-14 md:pt-20 text-center">
        <Pill className="mx-auto">
          <LiveDot />
          <span className="tnum text-ink-muted">
            {stats.salaried.toLocaleString()} salaried roles · {stats.companies} companies · {stats.cities} cities
          </span>
        </Pill>
        <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-semibold leading-[1.08] tracking-tight md:text-6xl">
          Know what Europe actually pays <span className="serif-accent gradient-text">you.</span>
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
        {result === null ? (
          <EmptyPrompt />
        ) : !result.enough ? (
          <NotEnough result={result} />
        ) : (
          <Results result={result} />
        )}
      </section>
    </div>
  );
}

function Results({ result }: { result: Awaited<ReturnType<typeof searchSalaries>> }) {
  const sp = result.spread!;
  const you = result.base;
  const below = result.baseDelta != null && result.baseDelta < 0;
  const tone = below ? "var(--ember)" : "var(--mint)";

  return (
    <div className="space-y-5">
      {/* Headline card with measure bar */}
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
            <span className="tnum font-semibold" style={{ color: tone }}>
              {eur(Math.abs(result.baseDelta))} {below ? "below" : "above"}
            </span>{" "}
            the median — around the{" "}
            <span className="tnum font-semibold">{ordinal(result.basePercentile!)}</span> percentile for this role.
          </p>
        ) : (
          <p className="text-center text-ink-muted">
            Half of these roles advertise between{" "}
            <span className="tnum text-ink">{eurK(sp.p25)}</span> and{" "}
            <span className="tnum text-ink">{eurK(sp.p75)}</span>.
          </p>
        )}
      </Card>

      {/* Stats strip */}
      <Card>
        <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
          <Stat label="Postings analysed" value={<span className="tnum">{result.advertisedN}</span>} />
          <Stat label="Advertised · verified" value={<span className="tnum">{result.advertisedN} · {result.verifiedN}</span>} />
          <Stat label="Middle 50% spread" value={<span className="tnum">{eurK(sp.p25)}–{eurK(sp.p75)}</span>} />
          <Stat label="P10 → P90" value={<span className="tnum">{eurK(sp.p10)}–{eurK(sp.p90)}</span>} />
        </div>
      </Card>

      <div className="grid gap-5 md:grid-cols-2">
        {/* Top payers */}
        <Card>
          <h3 className="text-sm font-medium text-ink-muted">Top payers <span className="text-ink-faint">· {result.role === "Any" ? "all roles" : result.role}</span></h3>
          {result.topPayers.length === 0 ? (
            <p className="mt-3 text-sm text-ink-faint">Not enough per-company data yet (need 3+ salaried postings).</p>
          ) : (
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
          )}
        </Card>

        {/* Across cities */}
        <Card>
          <h3 className="text-sm font-medium text-ink-muted">Same role, other cities</h3>
          {result.acrossCities.length === 0 ? (
            <p className="mt-3 text-sm text-ink-faint">Not enough city-level data yet (need 5+ per city).</p>
          ) : (
            <ul className="mt-3 space-y-1.5">
              {result.acrossCities.map((c) => (
                <li key={c.cityKey}>
                  <Link href={`/?role=${encodeURIComponent(result.role)}&city=${encodeURIComponent(c.cityKey)}#results`} className="surface-hover flex items-center justify-between rounded-xl border px-3 py-2.5 transition-colors">
                    <span>{c.city}</span>
                    <span className="tnum text-ink">{eur(c.median)} <span className="text-ink-faint">· {c.n}</span></span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <p className="text-center text-xs text-ink-faint">
        Advertised base only (not total comp). EUR figures approximate. See{" "}
        <Link href="/methodology" className="underline hover:text-ink">methodology</Link>.
      </p>
    </div>
  );
}

function NotEnough({ result }: { result: Awaited<ReturnType<typeof searchSalaries>> }) {
  return (
    <Card className="text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full" style={{ background: "var(--surface-3)" }}>
        <span className="text-xl">◔</span>
      </div>
      <h2 className="text-lg font-medium">Not enough recent data yet</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">
        We only found <span className="tnum">{result.n}</span> recent salaried posting{result.n === 1 ? "" : "s"} for{" "}
        {result.role === "Any" ? "this search" : result.role}
        {result.city !== "Europe" ? ` in ${result.city}` : ""}. We need at least 8 before we&apos;ll show a median —
        we won&apos;t invent one.
      </p>
      <div className="mt-4 flex justify-center gap-3">
        <GhostLink href="/#results">Broaden the search</GhostLink>
        <GhostLink href="/add">Add your salary</GhostLink>
      </div>
    </Card>
  );
}

function EmptyPrompt() {
  return (
    <div className="text-center text-sm text-ink-faint">
      Pick a role and city above to see real numbers.
    </div>
  );
}

function NotConfigured() {
  return (
    <div className="py-24 text-center">
      <h1 className="text-2xl font-semibold">Trueline</h1>
      <p className="mx-auto mt-3 max-w-md text-ink-muted">
        Supabase isn&apos;t configured yet. Set <code className="tnum">SUPABASE_URL</code> and{" "}
        <code className="tnum">SUPABASE_ANON_KEY</code> in <code className="tnum">web/.env.local</code>, then reload.
      </p>
    </div>
  );
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
