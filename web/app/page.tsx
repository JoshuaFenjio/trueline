import Link from "next/link";
import {
  getLiveStats, getFilterOptions, getSectors, getLeaderboards, getCompaniesBoard,
  getCityMapData, searchSalaries, isConfigured,
} from "@/lib/data";
import type { Metadata } from "next";
import { SearchForm } from "@/components/SearchForm";
import { SmartSearch } from "@/components/SmartSearch";
import { EmeaMap } from "@/components/EmeaMap";
import { MeasureBar } from "@/components/MeasureBar";
import { ShareButton } from "@/components/ShareButton";
import { Card, Stat, GhostLink } from "@/components/ui";
import { SectionHeader, Chip, ArrowLink } from "@/components/blocks";
import { EmailCapture } from "@/components/EmailCapture";
import { eur, eurK, slugify, pct } from "@/lib/format";

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

// Left-notch colour per sector for the browse chips.
const SECTOR_COLOR: Record<string, string> = {
  AI: "#8F7BFF", Fintech: "#4EC9FF", Devtools: "#5E8BFF", SaaS: "#A78BFA",
  Consumer: "#FF6A45", Health: "#4ADE9C", Mobility: "#F5B84B",
  Security: "#FF8FA3", Other: "#6E7480",
};

export default async function Home({
  searchParams,
}: {
  searchParams: { role?: string; level?: string; city?: string; base?: string };
}) {
  if (!isConfigured) return <NotConfigured />;

  const [stats, options, sectors, lb, board, mapData] = await Promise.all([
    getLiveStats(), getFilterOptions(), getSectors(), getLeaderboards(), getCompaniesBoard(),
    getCityMapData(),
  ]);
  const companyList = board.map((c) => ({ name: c.company, slug: c.slug }));
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
      <section className="pt-16 text-center md:pt-24">
        <h1 className="mx-auto max-w-3xl text-5xl font-extrabold leading-[1.03] tracking-[-0.04em] md:text-[64px]">
          Know what Europe actually pays.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-ink-muted">
          Real base salaries from live job postings across Europe, the Middle East and Africa.
        </p>
      </section>

      {/* Search — dominant */}
      <section className="mx-auto mt-8 max-w-2xl">
        <SmartSearch roles={options.roles} cities={options.cities} companies={companyList} />
        <p className="tnum mt-3 text-center text-[13px] text-ink-faint">
          <Count n={stats.salaried} /> salaried roles
          <Dot /> <Count n={stats.companies} /> companies
          <Dot /> <Count n={stats.cities} /> cities
        </p>
        <details className="group mt-4">
          <summary className="tnum mx-auto flex w-max cursor-pointer list-none items-center gap-1 text-[11px] uppercase tracking-[0.18em] text-ink-faint hover:text-ink">
            Refine <span className="transition-transform group-open:rotate-180">▾</span>
          </summary>
          <div className="mt-3">
            <SearchForm roles={options.roles} cities={options.cities} current={searchParams} compact />
          </div>
        </details>
      </section>

      {/* Results */}
      <section id="results" className="mx-auto mt-8 max-w-4xl scroll-mt-20">
        {result === null ? null : !result.enough ? <NotEnough result={result} /> : <Results result={result} />}
      </section>

      {/* EMEA map */}
      {mapData.cities.length > 0 && (
        <section className="mt-24">
          <SectionHeader kicker="Geography" title="Where Europe pays" />
          <div className="mt-6">
            <EmeaMap cities={mapData.cities} emeaMedian={mapData.emeaMedian} />
          </div>
        </section>
      )}

      {/* Browse tiles */}
      <section className="mt-24">
        <SectionHeader title="Browse" />
        <div className="mt-7 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <BrowseTile title="Sectors" href="/leaderboards#by-sector">
            {sectors.slice(0, 6).map((s) => (
              <SectorChip key={s} sector={s} />
            ))}
          </BrowseTile>
          <BrowseTile title="Roles" href={options.roles[0] ? `/roles/${slugify(options.roles[0])}` : "/leaderboards#by-role"}>
            {options.roles.slice(0, 6).map((r) => (
              <RoleChip key={r} role={r} />
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
                <div className="mt-2 text-2xl font-extrabold tracking-tight">Who pays most</div>
                <p className="mt-2 text-sm text-ink-muted">The top-paying companies by sector and country, and the most transparent employers.</p>
              </div>
              <span className="arrow-cue mt-4 inline-flex items-center gap-1 text-[11px] uppercase tracking-wider">
                Open leaderboards <span className="arw">→</span>
              </span>
            </Card>
          </Link>
        </div>
      </section>

      {/* Most transparent this week */}
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
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-md text-xs font-semibold"
                    style={{ background: "var(--surface-3)", color: "var(--ink-muted)" }}
                  >
                    {d.company.charAt(0)}
                  </span>
                  <span className="whitespace-nowrap text-sm">{d.company}</span>
                  <span
                    className="tnum text-lg font-semibold"
                    style={{ color: d.pct >= 90 ? "var(--mint)" : "var(--ink-muted)" }}
                  >
                    {pct(d.pct)}
                  </span>
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
        <ArrowLink href={href}>all</ArrowLink>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">{children}</div>
    </Card>
  );
}

// Sector chip: 3px colored left notch by sector.
function SectorChip({ sector }: { sector: string }) {
  return (
    <Link
      href={`/leaderboards?sector=${encodeURIComponent(sector)}#by-sector`}
      className="rounded-full border py-1.5 pl-3 pr-3.5 text-sm text-ink-muted transition-colors hover:text-ink"
      style={{ background: "var(--surface-1)", borderLeft: `3px solid ${SECTOR_COLOR[sector] || "#6E7480"}` }}
    >
      {sector}
    </Link>
  );
}

// Role chip: Geist Mono, to read as a distinct family from sector/city chips.
function RoleChip({ role }: { role: string }) {
  return (
    <Link
      href={`/roles/${slugify(role)}`}
      className="tnum rounded-full border px-3 py-1.5 text-[12px] text-ink-muted transition-colors hover:text-ink"
      style={{ background: "var(--surface-1)" }}
    >
      {role}
    </Link>
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
          <p className="text-center text-base">
            You&apos;re{" "}
            <span className="tnum font-semibold" style={{ color: tone }}>{eur(Math.abs(result.baseDelta))} {below ? "below" : "above"}</span>{" "}
            the median, around the <span className="tnum font-semibold">{ordinal(result.basePercentile!)}</span> percentile.
          </p>
        ) : (
          <p className="text-center text-ink-muted">
            Half of these roles advertise between <span className="tnum text-ink">{eurK(sp.p25)}</span> and <span className="tnum text-ink">{eurK(sp.p75)}</span>.
          </p>
        )}
        {result.verifiedMedian && (
          <p className="mt-3 text-center text-sm" style={{ color: "var(--mint)" }}>
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

function Count({ n }: { n: number }) {
  return <span className="tnum font-semibold text-ink">{n.toLocaleString()}</span>;
}
function Dot() {
  return <span className="mx-1.5 text-ink-faint/60">·</span>;
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
