import type { Metadata } from "next";
import Link from "next/link";
import {
  getLeaderboards, getCountryLeaderboard, getHomeComposition, getCityMapData,
  getLastRefreshed, isConfigured, RankRow,
} from "@/lib/data";
import { SectionHeader, RankTable, toPayVMs, Chip, Breadcrumbs, PillButton } from "@/components/blocks";
import { PayIndexTable, IndexRow } from "@/components/PayIndex";
import { TopCities } from "@/components/TopCities";
import { Flag } from "@/components/Flag";
import { Sparkline } from "@/components/Sparkline";
import { Icon } from "@/components/icons";
import { slugify, pct, eur, eurK, timeAgo } from "@/lib/format";

export const revalidate = 3600;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: { sector?: string; role?: string; crole?: string };
}): Promise<Metadata> {
  let kicker = "Leaderboards", title = "Who pays most", value = "Live from company job boards";
  if (searchParams.sector) { kicker = "Top payers · by sector"; title = searchParams.sector; value = "Highest-paying companies"; }
  else if (searchParams.role) { kicker = "Top payers · by role"; title = searchParams.role; value = "Who pays this role most"; }
  else if (searchParams.crole) { kicker = "By country · " + searchParams.crole; title = "Which countries pay most"; value = searchParams.crole; }
  const og = `/og?kicker=${encodeURIComponent(kicker)}&title=${encodeURIComponent(title)}&value=${encodeURIComponent(value)}`;
  return {
    title: `${title} · EMEA salary leaderboards · SalaryRadar`,
    description: "Live leaderboards of the top-paying tech companies in EMEA, by sector, role and country, plus the most transparent employers.",
    openGraph: { title, images: [og] },
    twitter: { card: "summary_large_image", images: [og] },
  };
}

function href(base: string, patch: Record<string, string>, current: Record<string, string | undefined>, anchor: string) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...current, ...patch })) if (v) p.set(k, v);
  return `${base}?${p.toString()}#${anchor}`;
}

const TABS = [
  { id: "countries", label: "Countries", icon: Icon.globe },
  { id: "by-sector", label: "By sector", icon: Icon.layers },
  { id: "by-role", label: "By role", icon: Icon.briefcase },
  { id: "overall", label: "Overall", icon: Icon.trophy },
  { id: "transparent", label: "Transparency", icon: Icon.shield },
];

const VALUE_PROPS = [
  { icon: Icon.briefcase, t: "Live from job boards", d: "Every figure scraped from companies' own public postings." },
  { icon: Icon.shield, t: "Gated medians", d: "No median below 8 postings. Below the gate we say so." },
  { icon: Icon.bars, t: "Base pay, not TC", d: "Advertised base salary only. No guessed bonus or equity." },
  { icon: Icon.refresh, t: "Refreshed 6-hourly", d: "Re-scraped around the clock, not an annual survey." },
  { icon: Icon.globe, t: "EMEA-wide", d: "Europe, the Middle East and Africa, city by city." },
];

function transparencyTone(p: number): string {
  return p >= 50 ? "var(--mint)" : p >= 25 ? "var(--accent)" : "var(--ember)";
}

export default async function Leaderboards({
  searchParams,
}: {
  searchParams: { sector?: string; role?: string; crole?: string };
}) {
  if (!isConfigured) return <p className="py-24 text-center text-ink-muted">Supabase not configured.</p>;
  const [lb, countries, comp, mapData, refreshed] = await Promise.all([
    getLeaderboards(), getCountryLeaderboard(), getHomeComposition(), getCityMapData(), getLastRefreshed(),
  ]);

  const toIndexRows = (rows: RankRow[]): IndexRow[] => {
    const max = Math.max(1, ...rows.map((r) => r.value));
    return rows.map((r) => ({ company: r.label, slug: r.slug, sector: "", score: 0, value: eurK(r.value), barPct: r.value / max }));
  };

  const sector = searchParams.sector || lb.bySector[0]?.sector;
  const role = searchParams.role || lb.byRole[0]?.role;
  const sectorRows = lb.bySector.find((s) => s.sector === sector)?.rows || [];
  const roleRows = lb.byRole.find((r) => r.role === role)?.rows || [];
  const cur = { sector: searchParams.sector, role: searchParams.role };

  const maxMed = Math.max(1, ...countries.map((c) => c.median));
  const topTransparency = [...countries].filter((c) => c.trackedN >= 10).sort((a, b) => b.disclosurePct - a.disclosurePct).slice(0, 6);

  return (
    <div className="pb-4">
      <div className="pt-8"><Breadcrumbs items={[{ label: "Leaderboards" }]} /></div>

      {/* Hero */}
      <section className="mt-6 grid items-center gap-10 min-[900px]:grid-cols-[1fr_.85fr]">
        <div>
          <span className="eyebrow-pill"><span className="eyebrow">Live pay rankings · {countries.length} countries</span></span>
          <h1 className="t-h1 mt-5">
            Europe&rsquo;s real pay.<br /><span className="font-normal italic">Ranked with transparency.</span>
          </h1>
          <p className="mt-4 max-w-lg text-lg leading-relaxed text-ink-muted">
            Live rankings from real EMEA job-board data. Every company, role and country here is a link. Medians need 8+ postings; company midpoints need 3+.
          </p>
        </div>
        {comp.emeaMedian > 0 && (
          <div className="hidden min-[900px]:block">
            <div className="card-float mx-auto max-w-xs p-6">
              <div className="text-[12px] text-ink-faint">EMEA median base salary</div>
              <div className="tnum mt-2 text-3xl font-semibold">{eur(comp.emeaMedian)}</div>
              <div className="tnum mt-1 text-[12px] text-ink-faint">{comp.salaried.toLocaleString()} salaried roles</div>
              {comp.spark.length >= 2 && <div className="mt-4"><Sparkline values={comp.spark} width={260} height={44} className="w-full" /></div>}
            </div>
          </div>
        )}
      </section>

      {/* Pill tab bar */}
      <nav className="mt-10 flex flex-wrap gap-2 border-b pb-4" style={{ borderColor: "var(--border)" }} aria-label="Leaderboard views">
        {TABS.map((t) => (
          <a key={t.id} href={`#${t.id}`} className="pill-btn"><t.icon size={15} /><span>{t.label}</span></a>
        ))}
      </nav>
      <p className="mt-3 text-[12px] text-ink-faint">View: <span className="text-ink">Median base salary</span> · Source: SalaryRadar data · Updated {timeAgo(refreshed)}</p>

      {/* Countries — primary */}
      <section className="mt-10 scroll-mt-24" id="countries">
        <SectionHeader kicker="By country" title="Top paying countries in Europe" sub="Median advertised base salary, with each market's transparency — the share of tracked ads that publish pay." />
        <div className="mt-6 card overflow-hidden !p-0">
          <div className="flex items-center gap-3 border-b px-4 py-3 text-[12px] text-ink-faint" style={{ borderColor: "var(--border)" }}>
            <span className="w-6 text-right">#</span><span className="ml-1 flex-1">Country</span>
            <span className="mx-4 hidden w-40 sm:block">Median base</span>
            <span className="w-24 text-right">Median</span>
            <span className="ml-4 hidden w-28 text-right md:block">Transparency</span>
          </div>
          <ol>
            {countries.slice(0, 15).map((c, i) => (
              <li key={c.country} className="border-t" style={{ borderColor: "var(--border)" }}>
                <Link href={`/locations/country/${slugify(c.country)}`} className="flex h-12 items-center gap-3 px-4 transition-colors hover:bg-[var(--band)]">
                  <span className="tnum w-6 text-right text-sm text-ink-faint">{i + 1}</span>
                  <Flag country={c.country} />
                  <span className="min-w-0 flex-1 truncate">{c.country} <span className="tnum ml-1 text-[11px] text-ink-faint">n={c.n}</span></span>
                  <span className="mx-4 hidden w-40 sm:block"><span className="rank-track block"><span className="rank-fill" style={{ width: `${(c.median / maxMed) * 100}%`, background: "var(--accent)" }} /></span></span>
                  <span className="tnum w-24 text-right font-semibold">{eur(c.median)}</span>
                  <span className="ml-4 hidden w-28 items-center justify-end gap-2 md:flex">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ background: transparencyTone(c.disclosurePct) }} />
                    <span className="tnum text-sm">{pct(c.disclosurePct)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
          <div className="border-t px-4 py-2.5 text-[12px] text-ink-faint" style={{ borderColor: "var(--border)" }}>Source: SalaryRadar data · Updated {timeAgo(refreshed)}</div>
        </div>
      </section>

      {/* By sector */}
      <section className="mt-16 scroll-mt-24" id="by-sector">
        <SectionHeader kicker="By sector" title="Top payers by sector" />
        <div className="mt-5 flex flex-wrap gap-2">
          {lb.bySector.map((s) => (
            <Chip key={s.sector} href={href("/leaderboards", { sector: s.sector }, cur, "by-sector")} active={s.sector === sector}>{s.sector}</Chip>
          ))}
        </div>
        <div className="mt-6"><PayIndexTable rows={toIndexRows(sectorRows)} valueHead="Median" variant="value" /></div>
      </section>

      {/* By role */}
      <section className="mt-16 scroll-mt-24" id="by-role">
        <SectionHeader kicker="By role" title="Who pays this role most" />
        <div className="mt-5 flex flex-wrap gap-2">
          {lb.byRole.map((r) => (
            <Chip key={r.role} href={href("/leaderboards", { role: r.role }, cur, "by-role")} active={r.role === role}>{r.role}</Chip>
          ))}
        </div>
        <div className="mt-6"><PayIndexTable rows={toIndexRows(roleRows)} valueHead="Median" variant="value" /></div>
        {role && <p className="mt-3 text-sm text-ink-faint">See the full <a className="underline hover:text-ink" href={`/roles/${slugify(role)}`}>{role} role hub →</a></p>}
      </section>

      {/* Overall companies */}
      <section className="mt-16 scroll-mt-24" id="overall">
        <SectionHeader kicker="Overall" title="Top-paying companies" sub="Highest median advertised base across every sector. Company midpoints need 3+ salaried postings." />
        <div className="mt-6"><RankTable rows={toPayVMs(lb.topCompanies, (s) => `/companies/${s}`)} /></div>
      </section>

      {/* Transparency */}
      <section className="mt-16 scroll-mt-24" id="transparent">
        <SectionHeader kicker="Transparency" title="Most transparent employers" sub="What share of each company's tracked ads publish pay — we monitor the disclosed and the silent. Companies with 10+ live postings." />
        <div className="mt-6 card overflow-hidden !p-0">
          <ol>
            {lb.bestDisclosure.map((d, i) => {
              const inner = (
                <div className="flex h-12 items-center gap-3 px-4">
                  <span className="tnum w-6 text-right text-sm text-ink-faint">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate">{d.company} <span className="tnum ml-1 text-[11px] text-ink-faint">{d.activeN} ads</span></span>
                  <span className="mx-4 hidden w-40 sm:block"><span className="rank-track block"><span className="rank-fill" style={{ width: `${d.pct}%`, background: transparencyTone(d.pct) }} /></span></span>
                  <span className="tnum w-16 text-right font-semibold" style={{ color: transparencyTone(d.pct) }}>{pct(d.pct)}</span>
                </div>
              );
              return (
                <li key={d.slug} className="border-t first:border-t-0" style={{ borderColor: "var(--border)" }}>
                  {d.hasPage
                    ? <Link href={`/companies/${d.slug}`} className="block transition-colors hover:bg-[var(--band)]">{inner}</Link>
                    : inner}
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* Three-column band. #cities is the anchor the homepage's "Top-paying
          cities" header links to. */}
      <section className="band section-y mt-16 scroll-mt-24" id="cities">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="card">
            <div className="flex items-center gap-2.5"><span className="icon-chip"><Icon.pin size={15} /></span><span className="text-[15px] font-semibold">Top paying cities</span></div>
            <div className="mt-4"><TopCities cities={mapData.cities} emeaMedian={mapData.emeaMedian} excludeConcentrated /></div>
          </div>
          <div className="card">
            <div className="flex items-center gap-2.5"><span className="icon-chip"><Icon.shield size={15} /></span><span className="text-[15px] font-semibold">Highest transparency</span></div>
            <ol className="mt-4">
              {topTransparency.map((c, i) => (
                <li key={c.country} className="flex h-10 items-center gap-3 border-t first:border-t-0" style={{ borderColor: "var(--border)" }}>
                  <span className="tnum w-5 text-right text-sm text-ink-faint">{i + 1}</span>
                  <Flag country={c.country} /><span className="min-w-0 flex-1 truncate text-sm">{c.country}</span>
                  <span className="tnum text-sm font-semibold" style={{ color: transparencyTone(c.disclosurePct) }}>{pct(c.disclosurePct)}</span>
                </li>
              ))}
              {topTransparency.length === 0 && <li className="py-4 text-sm text-ink-faint">Not enough tracked postings yet.</li>}
            </ol>
          </div>
          <div className="band-dark flex flex-col p-6">
            <span className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: "rgba(255,255,255,.12)" }}><Icon.briefcase size={20} className="text-white" /></span>
            <h3 className="mt-4 text-xl font-bold text-white">Falling behind on pay?</h3>
            <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "rgba(255,255,255,.72)" }}>See where your offers sit against live base-pay data, by role and city.</p>
            <div className="mt-auto pt-6"><Link href="/for-companies" className="pill-btn pill-btn-light"><span>For employers</span><span className="arw">→</span></Link></div>
          </div>
        </div>
      </section>

      {/* Feature strip */}
      <section className="mt-16">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
          {VALUE_PROPS.map((v) => (
            <div key={v.t} className="card">
              <span className="icon-chip"><v.icon size={16} /></span>
              <div className="mt-3 text-[15px] font-semibold">{v.t}</div>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">{v.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Dual CTA band */}
      <section className="section-y">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="card flex flex-col gap-3">
            <div className="flex items-center gap-2.5"><span className="icon-chip"><Icon.search size={15} /></span><span className="text-[15px] font-semibold">For job seekers</span></div>
            <p className="text-[14px] text-ink-muted">Find the real range for your role and city, and see where your pay lands.</p>
            <div className="mt-1"><PillButton href="/">Search salaries</PillButton></div>
          </div>
          <div className="card flex flex-col gap-3">
            <div className="flex items-center gap-2.5"><span className="icon-chip"><Icon.briefcase size={15} /></span><span className="text-[15px] font-semibold">For employers</span></div>
            <p className="text-[14px] text-ink-muted">Benchmark your offers against live market data, before you lose the candidate.</p>
            <div className="mt-1"><PillButton href="/for-companies">For employers</PillButton></div>
          </div>
        </div>
      </section>
    </div>
  );
}
