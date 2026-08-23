import Link from "next/link";
import {
  getLiveStats, getFilterOptions, getSectors, getCompaniesBoard,
  getCityMapData, getSectorCounts, getRoleIndex,
  getEuropePayData, getHomeComposition, getHeroBand, topCountryFinding, searchSalaries, isConfigured,
} from "@/lib/data";
import type { Metadata } from "next";
import { SearchForm } from "@/components/SearchForm";
import { SmartSearch } from "@/components/SmartSearch";
import { WhoPaysInteractive } from "@/components/WhoPaysInteractive";
import { HeroComposition } from "@/components/HeroComposition";
import { Flag } from "@/components/Flag";
import { MeasureBar } from "@/components/MeasureBar";
import { ShareButton } from "@/components/ShareButton";
import { Card, Stat, GhostLink } from "@/components/ui";
import { EuropePayMap } from "@/components/EuropePayMap";
import { SectionHeader, ArrowLink } from "@/components/blocks";
import { EmailCapture } from "@/components/EmailCapture";
import { parseQuery } from "@/lib/parseQuery";
import { WATCHLIST } from "@/lib/watchlist";
import { eur, eurK, slugify } from "@/lib/format";

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

export default async function Home({
  searchParams,
}: {
  searchParams: { role?: string; level?: string; city?: string; base?: string; q?: string };
}) {
  if (!isConfigured) return <NotConfigured />;

  const [stats, options, sectors, board, mapData, sectorCounts, roleIdx, europe, comp, heroBand] = await Promise.all([
    getLiveStats(), getFilterOptions(), getSectors(), getCompaniesBoard(),
    getCityMapData(), getSectorCounts(), getRoleIndex(),
    getEuropePayData(), getHomeComposition(), getHeroBand(),
  ]);
  // Per-role top-country findings for the map insight card, computed at build
  // time from the pay data (never hand-written). Keyed by role, incl. "All roles".
  const findings: Record<string, ReturnType<typeof topCountryFinding>> = {};
  for (const [roleKey, rp] of Object.entries(europe.data)) findings[roleKey] = topCountryFinding(rp);
  const boardSlugs = new Set(board.map((c) => c.slug));
  const companyList = [
    ...board.map((c) => ({ name: c.company, slug: c.slug })),
    // famous watchlist names so a search for "Uber" finds its honest page
    ...WATCHLIST.filter((w) => !boardSlugs.has(slugify(w.name))).map((w) => ({ name: w.name, slug: slugify(w.name) })),
  ];
  const countryNames = europe.data["All roles"].countries.map((c) => c.country).sort();
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
      {/* Hero — two columns: search-led text left, live composition right. The
          composition panel is hidden below 900px (hero becomes text-only). */}
      <section className="grid items-center gap-10 pt-10 md:pt-14 min-[900px]:grid-cols-[1fr_1.12fr] min-[900px]:gap-12">
        <div>
          <span className="eyebrow-pill">
            <span className="eyebrow">
              Live salary data · {stats.companies.toLocaleString()} companies · {countryNames.length} countries
            </span>
          </span>
          <h1 className="t-h1 mt-5 max-w-xl">
            Know what Europe <span className="font-normal italic">actually</span> pays.
          </h1>
          <p className="mt-4 max-w-lg text-lg leading-relaxed text-ink-muted">
            Real base salaries from live job postings across Europe, the Middle East and Africa.
          </p>

          <div className="mt-7">
            <SmartSearch roles={options.roles} cities={options.cities} companies={companyList} countries={countryNames} />
          </div>

          {/* Popular searches — real top roles by volume */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-[13px] text-ink-faint">Popular searches:</span>
            {topRoles.slice(0, 5).map((r) => (
              <Link key={r.slug} href={`/roles/${r.slug}`} className="rounded-full border px-3 py-1.5 text-[13px] text-ink-muted transition-colors hover:border-[var(--border-strong)] hover:text-ink" style={{ background: "var(--surface-1)" }}>{r.name}</Link>
            ))}
          </div>

          <details className="group mt-3">
            <summary className="arrow-link flex w-max cursor-pointer list-none items-center gap-1 text-xs">
              Browse all <span className="arw transition-transform group-open:rotate-90">→</span>
            </summary>
            <div className="mt-4 space-y-4">
              <SearchForm roles={options.roles} cities={options.cities} current={{ role, city, level: searchParams.level, base: searchParams.base }} compact />
              <div>
                <div className="mb-2 text-xs text-ink-faint">Sectors</div>
                <div className="flex flex-wrap gap-2">
                  {topSectors.map((s) => (
                    <Link key={s.sector} href={`/companies?sector=${encodeURIComponent(s.sector)}`} className="rounded-full border px-3 py-1 text-sm text-ink-muted transition-colors hover:text-ink" style={{ background: "var(--surface-1)" }}>
                      {s.sector} <span className="tnum text-xs text-ink-faint">{s.n}</span>
                    </Link>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-2 text-xs text-ink-faint">Roles</div>
                <div className="flex flex-wrap gap-2">
                  {[...roleIdx].filter((r) => r.name !== "Other").sort((a, b) => b.n - a.n).slice(0, 14).map((r) => (
                    <Link key={r.slug} href={`/roles/${r.slug}`} className="rounded-full border px-3 py-1 text-sm text-ink-muted transition-colors hover:text-ink" style={{ background: "var(--surface-1)" }}>{r.name}</Link>
                  ))}
                </div>
              </div>
            </div>
          </details>
        </div>

        {/* Right column — live-data composition. Reserve height to avoid CLS. */}
        <div className="hidden min-[900px]:block">
          <HeroComposition comp={comp} />
        </div>
      </section>

      {/* Country stat band — median base for a fixed reference slice, per country,
          from live gated data. Horizontal-scroll on mobile. */}
      {heroBand.cells.length > 0 && (
        <section className="mt-8 md:mt-10">
          <div className="card overflow-hidden !p-0">
            <div className="flex flex-col md:flex-row md:items-stretch">
              <div className="shrink-0 border-b p-5 md:w-60 md:border-b-0 md:border-r" style={{ borderColor: "var(--border)" }}>
                <div className="text-[12px] text-ink-faint">Median base salary</div>
                <div className="t-h3 mt-1">
                  <Link href={`/roles/${slugify(heroBand.role)}`} className="hover:text-[var(--accent)]">{heroBand.role}</Link>
                </div>
                <div className="text-[13px] text-ink-muted">{heroBand.level} · gated at n = 8</div>
              </div>
              <div className="flex gap-0 overflow-x-auto md:flex-1">
                {heroBand.cells.map((c) => (
                  <Link
                    key={c.country}
                    href={`/locations/country/${slugify(c.country)}`}
                    className="flex min-w-[136px] flex-1 flex-col gap-1.5 border-l p-5 transition-colors first:border-l-0 hover:bg-[var(--band)] md:border-l"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <span className="flex items-center gap-2">
                      <Flag country={c.country} />
                      <span className="truncate text-sm">{c.country}</span>
                    </span>
                    <span className="tnum text-lg font-semibold">{eur(c.median)}</span>
                    <span className="tnum text-[11px] text-ink-faint">n={c.n}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Search answer: country-level view for this role, above the results */}
      {result !== null && (
        <section id="results" className="mx-auto mt-10 max-w-5xl scroll-mt-20">
          <SectionHeader kicker="Across Europe" title={`${result.role === "Any" ? "All roles" : result.role} pay by country`} />
          <div className="surface mt-5 rounded-card p-5">
            <EuropePayMap
              data={europe}
              withTable
              initialRole={result.role === "Any" ? "All roles" : result.role}
              highlightCountry={result.city}
              facts={[
                { label: "Top payer", value: result.topPayers[0]?.company ?? "—" },
                { label: "EMEA median", value: eur((europe.data[result.role === "Any" ? "All roles" : result.role] ?? europe.data["All roles"]).emeaMedian) },
                { label: "Sample", value: `${result.advertisedN} postings` },
              ]}
            />
          </div>
          <div className="mt-8">
            {!result.enough ? <NotEnough result={result} /> : <Results result={result} />}
          </div>
        </section>
      )}

      {/* Who pays the most — interactive, on a sage band */}
      {board.length > 0 && (
        <section className="band mt-16 py-14">
          <div className="flex items-end justify-between gap-4">
            <SectionHeader kicker="A first look" title="Who pays the most" sub="Discover the top-paying companies and cities across Europe." />
            <span className="hidden md:block"><ArrowLink href="/companies">View full ranking</ArrowLink></span>
          </div>
          <div className="mt-6">
            <WhoPaysInteractive
              companies={board.map((c) => ({ company: c.company, slug: c.slug, sector: c.sector, payScore: c.payScore }))}
              cities={mapData.cities}
              sectors={sectors}
              countries={countryNames}
              emeaMedian={mapData.emeaMedian}
            />
          </div>
          <div className="mt-6 md:hidden"><ArrowLink href="/companies">View full ranking</ArrowLink></div>
        </section>
      )}

      {/* Europe pay map — three columns: country table · map on the band · insight */}
      <section className="band section-y mt-16">
        <div className="flex items-end justify-between gap-4">
          <SectionHeader kicker="Geography" title="The Europe pay map" />
          <span className="hidden md:block"><ArrowLink href="/locations/countries">Explore countries</ArrowLink></span>
        </div>
        <div className="mt-8">
          <EuropePayMap data={europe} triptych findings={findings} spark={comp.spark} />
        </div>
      </section>

      {/* Employer CTA — full-width dark teal band card */}
      <section className="section-y">
        <div className="band-dark flex flex-col gap-8 p-8 md:p-10 min-[900px]:flex-row min-[900px]:items-center min-[900px]:justify-between">
          <div className="min-[900px]:max-w-xl">
            <div className="flex items-center gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full" style={{ background: "rgba(255,255,255,.12)" }} aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18" />
                </svg>
              </span>
              <h2 className="text-2xl font-bold tracking-tight text-white md:text-[28px]">Hiring? Benchmark your pay against your sector.</h2>
            </div>
            <p className="mt-4 text-[15px] leading-relaxed" style={{ color: "rgba(255,255,255,.72)" }}>
              See where your offers sit against live base-pay data from real job postings, by role and city.
            </p>
            <div className="mt-6 flex flex-wrap gap-x-8 gap-y-3">
              {[
                { t: "Real market data", d: "M3 13V7M8 13V4M13 13V9" }, // bar chart
                { t: "Directive-ready ranges", d: "M8 2v12M4 5l4-3 4 3M3.5 8.5h9M4 8.5l-1 3h3zM12 8.5l-1 3h3z" }, // scales
                { t: "Transparency score", d: "M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8ZM8 6.2a1.8 1.8 0 100 3.6 1.8 1.8 0 000-3.6Z" }, // eye
              ].map((f) => (
                <div key={f.t} className="flex items-center gap-2">
                  <svg className="shrink-0" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--mint)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={f.d} /></svg>
                  <span className="text-[13px] font-medium text-white">{f.t}</span>
                </div>
              ))}
            </div>
          </div>
          <Link href="/for-companies" className="pill-btn pill-btn-light shrink-0 self-start px-6 py-3 text-sm min-[900px]:self-center">
            <span>For employers</span><span className="arw">→</span>
          </Link>
        </div>
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
      <div className="text-[11px] text-ink-faint">Gated · sample too small</div>
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

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
