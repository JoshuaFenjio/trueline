import Link from "next/link";
import {
  getLiveStats, getFilterOptions, getSectors, getCompaniesBoard, getLeaderboards,
  getCityMapData, getLastRefreshed, getSectorCounts, getRecentSalaried, getRoleIndex,
  getEuropePayData, searchSalaries, isConfigured,
} from "@/lib/data";
import type { Metadata } from "next";
import { SearchForm } from "@/components/SearchForm";
import { SmartSearch } from "@/components/SmartSearch";
import { TopCities } from "@/components/TopCities";
import { LiveSalaryCards } from "@/components/LiveSalaryCards";
import { MeasureBar } from "@/components/MeasureBar";
import { ShareButton } from "@/components/ShareButton";
import { Card, Stat, GhostLink } from "@/components/ui";
import { PayIndexTable, PayScaleLegend } from "@/components/PayIndex";
import { EuropePayMap } from "@/components/EuropePayMap";
import { SectionHeader, ArrowLink, RankTable, toPayVMs } from "@/components/blocks";
import { EmailCapture } from "@/components/EmailCapture";
import { parseQuery } from "@/lib/parseQuery";
import { eur, eurK, slugify, pct, timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

function sliceLabel(role: string, level: string, city: string): string {
  const parts = [role === "Any" ? "All roles" : role];
  if (level !== "Any") parts.push(level);
  parts.push(city);
  return parts.join(" · ");
}

// Per-query OG so a shared search URL previews the headline stat on LinkedIn.
export async function generateMetadata({
  searchParams,
}: {
  searchParams: { role?: string; level?: string; city?: string; base?: string };
}): Promise<Metadata> {
  const hasQuery = Boolean(searchParams.role || searchParams.city || searchParams.level);
  if (!isConfigured || !hasQuery) return {};
  const r = await searchSalaries({ role: searchParams.role, level: searchParams.level, city: searchParams.city });
  const slice = sliceLabel(r.role, r.level, r.city);
  if (!r.enough || !r.spread) {
    return { title: `${slice} salary · Trueline` };
  }
  const figure = `${eurK(r.spread.median)} median`;
  const title = `${slice}: ${figure} · Trueline`;
  const og = `/og?kicker=${encodeURIComponent(slice)}&title=${encodeURIComponent(figure)}&value=${encodeURIComponent(`${r.n} salaried postings`)}`;
  return {
    title,
    description: `${slice}: ${figure} base, from ${r.n} live job postings. Real EMEA salary benchmarks.`,
    openGraph: { title, images: [og] },
    twitter: { card: "summary_large_image", title, images: [og] },
  };
}

const LENSES = [
  { href: "/roles", kicker: "By role", title: "Salaries by role", line: "Medians by role and seniority, EMEA-wide." },
  { href: "/locations", kicker: "By city", title: "Salaries by city", line: "What each tech hub actually pays." },
  { href: "/locations/countries", kicker: "By country", title: "Salaries by country", line: "Compare national markets side by side." },
  { href: "/companies", kicker: "By company", title: "The Pay Index", line: "Every employer, ranked on pay." },
  { href: "/compare", kicker: "Compare", title: "Company vs company", line: "Two or three, role by role." },
  { href: "/leaderboards", kicker: "Leaderboards", title: "Who pays most", line: "Top payers by sector, role and country." },
];

const RULES = [
  { k: "Source", t: "Live job boards", d: "Every figure is scraped from companies' own public job postings." },
  { k: "Scope", t: "Base pay, not TC", d: "Advertised base salary only. No guessed bonus or equity." },
  { k: "Geography", t: "City-level, never national", d: "Anchored to the city on the posting, not a country average." },
  { k: "Honesty", t: "Gated at n = 8", d: "No median from a thin sample. Below the gate we say so." },
];

export default async function Home({
  searchParams,
}: {
  searchParams: { role?: string; level?: string; city?: string; base?: string; q?: string };
}) {
  if (!isConfigured) return <NotConfigured />;

  const [stats, options, sectors, board, lb, mapData, refreshed, sectorCounts, recent, roleIdx, europe] = await Promise.all([
    getLiveStats(), getFilterOptions(), getSectors(), getCompaniesBoard(), getLeaderboards(),
    getCityMapData(), getLastRefreshed(), getSectorCounts(), getRecentSalaried(), getRoleIndex(),
    getEuropePayData(),
  ]);
  const euroCountryRows = europe.data["All roles"].countries
    .filter((c) => c.median != null)
    .sort((a, b) => (b.median! - a.median!))
    .map((c) => ({ label: c.country, slug: slugify(c.country), value: c.median!, n: c.n }));
  const companyList = board.map((c) => ({ name: c.company, slug: c.slug }));
  const topCompanies = [...board].sort((a, b) => b.payScore - a.payScore).slice(0, 10);
  const topSectors = sectorCounts.filter((s) => s.sector !== "Other").slice(0, 6);
  const topRoles = [...roleIdx].filter((r) => r.name !== "Other").sort((a, b) => b.n - a.n).slice(0, 5);

  // Free-text nav search (?q=) → parse to role/city, else fall through.
  const parsed = searchParams.q ? parseQuery(searchParams.q, { roles: options.roles, cities: options.cities, companies: companyList }) : null;
  const role = searchParams.role ?? parsed?.role;
  const city = searchParams.city ?? parsed?.city;
  const hasQuery = Boolean(role || city || searchParams.level || searchParams.base);
  const result = hasQuery
    ? await searchSalaries({
        role, level: searchParams.level, city,
        base: searchParams.base ? Number(searchParams.base) : undefined,
      })
    : null;

  return (
    <div className="pb-4">
      {/* Hero — compact */}
      <section className="pt-8 text-center md:pt-10">
        <h1 className="mx-auto max-w-3xl text-4xl font-extrabold leading-[1.05] md:text-[44px]">
          Know what Europe actually pays.
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-ink-muted">
          Real base salaries from live job postings across Europe, the Middle East and Africa.
        </p>
      </section>

      {/* Search + compact stats line */}
      <section className="mx-auto mt-5 max-w-2xl">
        <SmartSearch roles={options.roles} cities={options.cities} companies={companyList} />
        <p className="tnum mt-3 text-center text-[13px] text-ink-faint">
          <Figure n={stats.salaried} /> salaried roles
          <Dot /> <Figure n={stats.companies} /> companies
          <Dot /> <Figure n={stats.cities} /> cities
          <Dot /> refreshed {timeAgo(refreshed)}
        </p>
        <details className="group mt-2">
          <summary className="tnum mx-auto flex w-max cursor-pointer list-none items-center gap-1 text-[11px] uppercase tracking-[0.18em] text-ink-faint hover:text-ink">
            Refine <span className="transition-transform group-open:rotate-180">▾</span>
          </summary>
          <div className="mt-3">
            <SearchForm roles={options.roles} cities={options.cities} current={{ role, city, level: searchParams.level, base: searchParams.base }} compact />
          </div>
        </details>
      </section>

      {/* Sector + role chip rows */}
      <section className="mx-auto mt-6 max-w-5xl">
        <div className="flex flex-wrap items-center justify-center gap-2">
          {topSectors.map((s) => (
            <Link key={s.sector} href={`/companies?sector=${encodeURIComponent(s.sector)}`} className="surface surface-hover inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm transition-colors">
              <span>{s.sector}</span>
              <span className="tnum text-xs text-ink-faint">{s.n}</span>
            </Link>
          ))}
          <Link href="/companies" className="tnum rounded-full px-3 py-1.5 text-xs uppercase tracking-wider text-ink-muted transition-colors hover:text-[var(--accent)]">More →</Link>
        </div>
        <div className="mt-2.5 flex flex-wrap items-center justify-center gap-2">
          {topRoles.map((r) => (
            <Link key={r.slug} href={`/roles/${r.slug}`} className="tnum rounded-full border px-3 py-1.5 text-[13px] text-ink-muted transition-colors hover:text-ink" style={{ background: "var(--surface-1)" }}>
              {r.name}
            </Link>
          ))}
          <Link href="/roles" className="tnum rounded-full px-3 py-1.5 text-xs uppercase tracking-wider text-ink-muted transition-colors hover:text-[var(--accent)]">More →</Link>
        </div>
      </section>

      {/* Live salary cards — proof of life */}
      {recent.length > 0 && (
        <section className="mx-auto mt-6 max-w-6xl">
          <LiveSalaryCards cards={recent} />
        </section>
      )}

      {/* Results (only when a query is present) */}
      {result !== null && (
        <section id="results" className="mx-auto mt-10 max-w-4xl scroll-mt-20">
          {!result.enough ? <NotEnough result={result} /> : <Results result={result} />}
        </section>
      )}

      {/* One dataset, six ways in — lead card + compact list (not an even grid) */}
      <section className="mt-20">
        <SectionHeader kicker="Start here" title="One dataset, six ways in" />
        <div className="mt-7 grid gap-5 lg:grid-cols-3">
          <Link href="/companies" className="group lg:col-span-2">
            <div className="flex h-full flex-col justify-between rounded-card border p-6 transition-colors md:p-8" style={{ background: "var(--accent-soft)", borderColor: "var(--accent)" }}>
              <div>
                <div className="tnum text-[10px] uppercase tracking-[0.18em] text-ink-faint">The Pay Index</div>
                <div className="mt-2 max-w-md text-2xl font-semibold tracking-tight md:text-3xl">Every employer, ranked on pay</div>
                <p className="mt-2 max-w-md text-ink-muted">A 0–100 Pay Score for {board.length} EMEA companies, each scored against its sector peers.</p>
              </div>
              <span className="arrow-cue mt-6 inline-flex items-center gap-1 text-[11px] uppercase tracking-wider">
                Open the index <span className="arw">→</span>
              </span>
            </div>
          </Link>
          <div className="surface divide-y overflow-hidden rounded-card" style={{ borderColor: "var(--border)" }}>
            {LENSES.filter((l) => l.href !== "/companies").map((l) => (
              <Link key={l.href} href={l.href} className="group flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-[var(--surface-1)]" style={{ borderColor: "var(--border)" }}>
                <span className="min-w-0">
                  <span className="tnum block text-[10px] uppercase tracking-[0.18em] text-ink-faint">{l.kicker}</span>
                  <span className="block truncate font-medium">{l.title}</span>
                </span>
                <span className="arrow-cue shrink-0 text-[11px]"><span className="arw">→</span></span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Top 10 — two-column preview */}
      {board.length > 0 && (
        <section className="mt-16">
          <div className="flex items-end justify-between gap-4">
            <SectionHeader kicker="A first look" title="Who pays the most" />
            <span className="hidden md:block"><ArrowLink href="/companies">View full ranking</ArrowLink></span>
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div>
              <div className="tnum mb-2 text-[11px] uppercase tracking-wider text-ink-faint">Top companies · Pay Score</div>
              <PayIndexTable
                compact
                rows={topCompanies.map((c) => ({ company: c.company, slug: c.slug, sector: c.sector, score: c.payScore }))}
              />
              <PayScaleLegend className="mt-3" />
            </div>
            <div>
              <div className="tnum mb-2 text-[11px] uppercase tracking-wider text-ink-faint">Top-paying cities · median base</div>
              {mapData.cities.length > 0
                ? <TopCities cities={mapData.cities} emeaMedian={mapData.emeaMedian} />
                : <p className="text-sm text-ink-faint">Not enough city data yet.</p>}
            </div>
          </div>
          <div className="mt-6 md:hidden"><ArrowLink href="/companies">View full ranking</ArrowLink></div>
        </section>
      )}

      {/* Europe pay map */}
      <section className="mt-16">
        <div className="flex items-end justify-between gap-4">
          <SectionHeader kicker="Geography" title="The Europe pay map" />
          <span className="hidden md:block"><ArrowLink href="/locations/countries">Explore countries</ArrowLink></span>
        </div>
        <div className="surface mt-6 hidden rounded-card p-5 md:block">
          <EuropePayMap data={europe} />
        </div>
        <div className="mt-6 md:hidden">
          {euroCountryRows.length
            ? <RankTable rows={toPayVMs(euroCountryRows, (s) => `/locations/country/${s}`)} />
            : <p className="text-sm text-ink-faint">Not enough country data yet.</p>}
        </div>
      </section>

      {/* Four rules — methodology preview, as an editorial list (airy rhythm) */}
      <section className="mt-28">
        <div className="flex items-end justify-between gap-4">
          <SectionHeader kicker="Method" title="Four rules. One honest number." />
          <span className="hidden md:block"><ArrowLink href="/methodology">Read the full methodology</ArrowLink></span>
        </div>
        <ol className="mt-8 border-t" style={{ borderColor: "var(--border)" }}>
          {RULES.map((r, i) => (
            <li key={r.k} className="grid gap-1 border-b py-6 md:grid-cols-[3.5rem_13rem_1fr] md:items-baseline md:gap-6 md:py-7" style={{ borderColor: "var(--border)" }}>
              <span className="tnum text-2xl font-semibold text-ink-faint">0{i + 1}</span>
              <span className="text-lg font-semibold tracking-tight">{r.t}</span>
              <p className="text-ink-muted">{r.d}</p>
            </li>
          ))}
        </ol>
        <div className="mt-6 md:hidden"><ArrowLink href="/methodology">Read the full methodology</ArrowLink></div>
      </section>

      {/* Most transparent companies */}
      {lb.bestDisclosure.length > 0 && (
        <section className="mt-20">
          <div className="flex items-center justify-between">
            <SectionHeader kicker="Transparency" title="Most transparent companies" />
            <span className="hidden md:block"><ArrowLink href="/leaderboards#transparent">See all</ArrowLink></span>
          </div>
          <div className="mt-6 flex gap-3 overflow-x-auto pb-2">
            {lb.bestDisclosure.slice(0, 10).map((d) => (
              <Link key={d.slug} href={`/companies/${d.slug}`} className="shrink-0">
                <div className="surface surface-hover flex items-center gap-3 rounded-2xl px-4 py-3 transition-colors">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md text-xs font-semibold" style={{ background: "var(--surface-3)", color: "var(--ink-muted)" }}>
                    {d.company.charAt(0)}
                  </span>
                  <span className="whitespace-nowrap text-sm">{d.company}</span>
                  <span className="tnum text-lg font-semibold text-ink-muted">{pct(d.pct)}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
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
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-medium">
            {result.role === "Any" ? "All roles" : result.role}
            {result.level !== "Any" && <span className="text-ink-muted"> · {result.level}</span>}
            <span className="text-ink-muted"> · {result.city}</span>
          </h2>
          <div className="flex items-center gap-3">
            <span className="tnum text-sm text-ink-faint">n = {result.n}</span>
            <ShareButton />
          </div>
        </div>
        <div className="mt-2 flex items-end gap-3">
          <div className="tnum text-4xl font-semibold md:text-5xl">{eur(sp.median)}</div>
          <div className="pb-1 text-sm text-ink-faint">median base / year</div>
        </div>
        <MeasureBar spread={sp} you={you} />
        {you != null && result.baseDelta != null ? (
          <p className="text-base">
            You&rsquo;re{" "}
            <span className="tnum font-semibold" style={{ color: tone }}>{eur(Math.abs(result.baseDelta))} {below ? "below" : "above"}</span>{" "}
            the median, around the <span className="tnum font-semibold">{ordinal(result.basePercentile!)}</span> percentile.
          </p>
        ) : (
          <p className="text-ink-muted">
            Half of these roles advertise between <span className="tnum text-ink">{eurK(sp.p25)}</span> and <span className="tnum text-ink">{eurK(sp.p75)}</span>.
          </p>
        )}
        {result.verifiedMedian && (
          <p className="mt-3 text-sm" style={{ color: "var(--mint)" }}>
            Verified <span className="tnum font-semibold">{eur(result.verifiedMedian)}</span> median from{" "}
            <span className="tnum">{result.verifiedN}</span> submitted salaries
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

      <Card>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-medium">Get notified when this benchmark updates</div>
            <div className="text-xs text-ink-faint">We refresh from live job boards. One email when this role and city moves.</div>
          </div>
          <div className="md:w-80"><EmailCapture source="candidate" cta="Notify me" placeholder="you@email.com" /></div>
        </div>
      </Card>
    </div>
  );
}

function NotEnough({ result }: { result: Awaited<ReturnType<typeof searchSalaries>> }) {
  const pctv = Math.min(100, (result.n / 8) * 100);
  return (
    <Card className="text-center">
      <div className="tnum text-[11px] uppercase tracking-[0.22em] text-ink-faint">Gated · sample too small</div>
      <h2 className="mt-2 text-2xl font-extrabold tracking-tight">Not enough recent data yet</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">
        We track <span className="tnum text-ink">{result.n}</span> salaried posting{result.n === 1 ? "" : "s"} for{" "}
        {result.role === "Any" ? "this search" : result.role}{result.city !== "Europe" ? ` in ${result.city}` : ""}. We show a median at <span className="tnum text-ink">8</span>.
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
        Supabase isn&rsquo;t configured. Set <code className="tnum">SUPABASE_URL</code> and <code className="tnum">SUPABASE_ANON_KEY</code> in <code className="tnum">web/.env.local</code>.
      </p>
    </div>
  );
}

function Figure({ n }: { n: number }) {
  return <span className="font-semibold text-ink">{n.toLocaleString()}</span>;
}
function Dot() {
  return <span className="mx-1.5 text-ink-faint/60">·</span>;
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
