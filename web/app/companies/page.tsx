import Link from "next/link";
import type { Metadata } from "next";
import { getCompaniesBoard, getSectors, getLastRefreshed, isConfigured } from "@/lib/data";
import { PayScaleLegend } from "@/components/PayIndex";
import { CompanyLogo } from "@/components/CompanyLogo";
import { Breadcrumbs, TrendBadge, PillButton } from "@/components/blocks";
import { ScoreBadge } from "@/components/ui";
import { Icon } from "@/components/icons";
import { payColor, PAY_BANDS } from "@/lib/payScale";
import { eur, pct, timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "The Pay Index",
  description: "Every EMEA company we track that discloses salaries, ranked 0–100 on how their advertised base pay compares to sector peers.",
};

const FACTORS = [
  { icon: Icon.bars, t: "Sector-relative base", d: "How a company's median advertised base compares to its sector peers — not an absolute figure." },
  { icon: Icon.briefcase, t: "Real job-board data", d: "Scraped from public postings, never surveyed or estimated." },
  { icon: Icon.shield, t: "Sample gates", d: "3+ salaried postings to be ranked; 8+ before any median shows." },
  { icon: Icon.refresh, t: "Freshness", d: "Re-scraped every six hours, around the clock." },
];

function ScoreDial({ score }: { score: number }) {
  const r = 34, circ = 2 * Math.PI * r, off = circ * (1 - score / 100), col = payColor(score);
  return (
    <svg viewBox="0 0 80 80" width={80} height={80} aria-hidden="true">
      <circle cx="40" cy="40" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="8" />
      <circle cx="40" cy="40" r={r} fill="none" stroke={col} strokeWidth="8" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={off} transform="rotate(-90 40 40)" />
      <text x="40" y="46" textAnchor="middle" fontSize="22" fontWeight="600" className="tnum" fill="var(--ink)">{score}</text>
    </svg>
  );
}

function coverageTier(n: number) { return n >= 30 ? "High" : n >= 10 ? "Medium" : "Low"; }
function coverageColor(t: string) { return t === "High" ? "var(--mint)" : t === "Medium" ? "var(--accent)" : "var(--ink-faint)"; }

const PAGE_SIZE = 40;

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: { sector?: string; q?: string; sort?: string; page?: string };
}) {
  if (!isConfigured) return <p className="py-24 text-center text-ink-muted">Supabase not configured.</p>;
  const [board, sectors, refreshed] = await Promise.all([getCompaniesBoard(), getSectors(), getLastRefreshed()]);
  const sector = searchParams.sector;
  const q = (searchParams.q || "").toLowerCase().trim();
  const sort = searchParams.sort === "sector" ? "sector" : "score";
  const page = Math.max(1, parseInt(searchParams.page || "1", 10) || 1);

  // Sector average midpoint for the vs-sector delta.
  const sectorMid = new Map<string, number[]>();
  for (const c of board) { const a = sectorMid.get(c.sector) || []; a.push(c.midpoint); sectorMid.set(c.sector, a); }
  const sectorAvg = new Map<string, number>();
  for (const [s, v] of sectorMid) sectorAvg.set(s, v.reduce((x, y) => x + y, 0) / v.length);

  const filtered = board
    .filter((c) => (!sector || c.sector === sector) && (!q || c.company.toLowerCase().includes(q)))
    .sort((a, b) => (sort === "sector" ? a.sector.localeCompare(b.sector) || b.payScore - a.payScore : b.payScore - a.payScore));

  const featured = [...board].sort((a, b) => b.payScore - a.payScore).slice(0, 5);
  const avgScore = board.length ? Math.round(board.reduce((s, c) => s + c.payScore, 0) / board.length) : 0;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Bottom cards.
  const bySector = [...sectorAvg.entries()].map(([s, avgMid]) => ({
    sector: s, avgScore: Math.round(board.filter((c) => c.sector === s).reduce((x, c) => x + c.payScore, 0) / board.filter((c) => c.sector === s).length),
    n: board.filter((c) => c.sector === s).length,
  })).sort((a, b) => b.avgScore - a.avgScore).slice(0, 6);
  const cov = { High: board.filter((c) => c.activeN >= 30).length, Medium: board.filter((c) => c.activeN >= 10 && c.activeN < 30).length, Low: board.filter((c) => c.activeN < 10).length };

  const qs = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { sector, q: searchParams.q, sort: searchParams.sort, ...extra };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return `/companies${s ? `?${s}` : ""}`;
  };

  return (
    <div className="pb-4">
      <div className="pt-8"><Breadcrumbs items={[{ label: "Companies", href: "/companies" }, { label: "Pay Index" }]} /></div>

      <header className="mt-6 max-w-3xl">
        <span className="eyebrow-pill"><span className="eyebrow">The Pay Index · {board.length} companies</span></span>
        <h1 className="t-h1 mt-5">The Pay Index.</h1>
        <p className="mt-4 text-lg leading-relaxed text-ink-muted">Every EMEA company we track that discloses salaries, scored 0–100 on how its median advertised base compares to sector peers.</p>
      </header>

      {/* Explainer + scale */}
      <section className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="card">
          <div className="flex items-center gap-4">
            <ScoreDial score={avgScore} />
            <div>
              <div className="text-[15px] font-semibold">How the Pay Index works</div>
              <p className="mt-1 text-[13px] text-ink-muted">Average score across the {board.length} ranked companies is <span className="tnum text-ink">{avgScore}</span>. Higher means better-paying for its sector.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {FACTORS.map((f) => (
              <div key={f.t} className="flex gap-3">
                <span className="icon-chip shrink-0"><f.icon size={15} /></span>
                <div><div className="text-[13px] font-medium">{f.t}</div><p className="mt-0.5 text-[12px] leading-relaxed text-ink-muted">{f.d}</p></div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-2.5"><span className="icon-chip"><Icon.target size={15} /></span><span className="text-[15px] font-semibold">The scale</span></div>
          <div className="mt-4 space-y-2.5">
            {PAY_BANDS.map((b) => (
              <div key={b.label} className="flex items-center gap-3 text-sm">
                <span className="inline-block h-3 w-3 rounded-[3px]" style={{ background: b.color }} />
                <span className="flex-1">{b.label}</span>
                <span className="tnum text-ink-faint">{b.range}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured */}
      <section className="mt-10">
        <div className="mb-4 text-[13px] font-medium text-ink-muted">Top 5 by Pay Score</div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {featured.map((c) => (
            <Link key={c.slug} href={`/companies/${c.slug}`} className="card card-hover flex flex-col items-center text-center">
              <CompanyLogo name={c.company} size={40} rounded="rounded-xl" />
              <div className="mt-3 truncate text-sm font-medium">{c.company}</div>
              <div className="mt-3"><ScoreBadge score={c.payScore} size="sm" /></div>
              <div className="mt-2 text-[11px]" style={{ color: payColor(c.payScore) }}>{PAY_BANDS.find((b) => c.payScore >= b.min)?.label ?? ""}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* Filters */}
      <div className="mt-10 flex flex-col gap-4">
        <form method="get" action="/companies" className="flex flex-wrap gap-2">
          {sector && <input type="hidden" name="sector" value={sector} />}
          {searchParams.sort && <input type="hidden" name="sort" value={searchParams.sort} />}
          <input name="q" defaultValue={searchParams.q || ""} placeholder="Search company…" className="field w-full max-w-xs px-3 py-2.5 text-sm" />
        </form>
        <div className="flex flex-wrap items-center gap-2">
          <Chip href={qs({ sector: undefined, page: undefined })} active={!sector}>All sectors</Chip>
          {sectors.map((s) => <Chip key={s} href={qs({ sector: s, page: undefined })} active={sector === s}>{s}</Chip>)}
        </div>
        <div className="flex items-center gap-2 text-xs text-ink-faint">
          <span>Sort</span>
          <Chip href={qs({ sort: undefined, page: undefined })} active={sort === "score"} small>Pay Score</Chip>
          <Chip href={qs({ sort: "sector", page: undefined })} active={sort === "sector"} small>Sector</Chip>
          <span className="ml-auto tnum">{filtered.length} ranked · updated {timeAgo(refreshed)}</span>
        </div>
      </div>

      {/* Main table */}
      {pageRows.length === 0 ? (
        <p className="mt-10 text-ink-faint">No companies match that filter.</p>
      ) : (
        <div className="mt-6 card overflow-hidden !p-0">
          <div className="flex items-center gap-3 border-b px-4 py-3 text-[12px] text-ink-faint" style={{ borderColor: "var(--border)" }}>
            <span className="w-6 text-right">#</span><span className="ml-1 flex-1">Company</span>
            <span className="mx-3 hidden w-32 md:block">Pay Score</span>
            <span className="hidden w-20 text-right sm:block">vs sector</span>
            <span className="hidden w-20 text-right md:block">Coverage</span>
            <span className="w-14 text-right">Trend</span>
          </div>
          <ol>
            {pageRows.map((c, i) => {
              const rank = (page - 1) * PAGE_SIZE + i + 1;
              const vs = c.midpoint - (sectorAvg.get(c.sector) || c.midpoint);
              const covT = coverageTier(c.activeN);
              const showTrend = c.trend.dir === "up" || c.trend.dir === "down" || c.trend.dir === "flat";
              return (
                <li key={c.slug} className="border-t" style={{ borderColor: "var(--border)" }}>
                  <Link href={`/companies/${c.slug}`} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[var(--band)]">
                    <span className="tnum w-6 text-right text-sm text-ink-faint">{rank}</span>
                    <CompanyLogo name={c.company} size={28} />
                    <span className="flex min-w-0 flex-1 items-center gap-2"><span className="truncate font-medium">{c.company}</span><span className="hidden shrink-0 rounded px-1.5 py-0.5 text-[10px] text-ink-faint sm:inline" style={{ background: "var(--surface-1)" }}>{c.sector}</span></span>
                    <span className="mx-3 hidden w-32 items-center gap-2 md:flex">
                      <span className="rank-track block flex-1"><span className="rank-fill" style={{ width: `${Math.max(3, c.payScore)}%`, background: payColor(c.payScore) }} /></span>
                      <span className="tnum w-6 text-right text-sm font-semibold" style={{ color: payColor(c.payScore) }}>{c.payScore}</span>
                    </span>
                    <span className="tnum hidden w-20 text-right text-sm sm:block" style={{ color: vs >= 0 ? "var(--mint)" : "var(--ember)" }}>{vs >= 0 ? "+" : "−"}{eur(Math.abs(Math.round(vs)))}</span>
                    <span className="hidden w-20 text-right md:block"><span className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ color: coverageColor(covT), background: `${coverageColor(covT)}1a` }}>{covT}</span></span>
                    <span className="w-14 text-right">{showTrend ? <TrendBadge trend={c.trend} className="!text-xs" /> : <span className="text-ink-faint">—</span>}</span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </div>
      )}
      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-5 flex items-center justify-center gap-3 text-sm">
          {page > 1 ? <Link href={qs({ page: String(page - 1) })} className="pill-btn">Prev</Link> : <span className="pill-btn opacity-40">Prev</span>}
          <span className="tnum text-ink-faint">Page {page} of {totalPages}</span>
          {page < totalPages ? <Link href={qs({ page: String(page + 1) })} className="pill-btn">Next</Link> : <span className="pill-btn opacity-40">Next</span>}
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2"><span className="text-[11px] text-ink-faint">Scale</span><PayScaleLegend /></div>

      {/* Bottom insight cards */}
      <section className="mt-12 grid gap-6 md:grid-cols-2">
        <div className="card">
          <div className="flex items-center gap-2.5"><span className="icon-chip"><Icon.layers size={15} /></span><span className="text-[15px] font-semibold">Average score by sector</span></div>
          <ol className="mt-4">
            {bySector.map((s) => (
              <li key={s.sector} className="flex h-9 items-center gap-3 border-t first:border-t-0" style={{ borderColor: "var(--border)" }}>
                <span className="flex-1 truncate text-sm">{s.sector} <span className="tnum text-[11px] text-ink-faint">{s.n}</span></span>
                <span className="tnum text-sm font-semibold" style={{ color: payColor(s.avgScore) }}>{s.avgScore}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="card">
          <div className="flex items-center gap-2.5"><span className="icon-chip"><Icon.shield size={15} /></span><span className="text-[15px] font-semibold">Data coverage</span></div>
          <p className="mt-1 text-[13px] text-ink-faint">How many tracked postings back each company&rsquo;s score.</p>
          <div className="mt-4 space-y-3">
            {(["High", "Medium", "Low"] as const).map((t) => (
              <div key={t} className="flex items-center gap-3">
                <span className="w-16 text-sm" style={{ color: coverageColor(t) }}>{t}</span>
                <span className="rank-track block flex-1"><span className="rank-fill" style={{ width: `${board.length ? (cov[t] / board.length) * 100 : 0}%`, background: coverageColor(t) }} /></span>
                <span className="tnum w-10 text-right text-sm">{cov[t]}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[12px] text-ink-faint">High = 30+ tracked postings · Medium = 10–29 · Low = under 10.</p>
        </div>
      </section>

      {/* Employer band */}
      <section className="section-y">
        <div className="band-dark flex flex-col gap-6 p-8 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-xl font-bold text-white">Where does your company rank?</h3>
            <p className="mt-2 text-[14px]" style={{ color: "rgba(255,255,255,.72)" }}>Benchmark your offers against the Pay Index, by role and city.</p>
          </div>
          <Link href="/for-companies" className="pill-btn pill-btn-light shrink-0"><span>For employers</span><span className="arw">→</span></Link>
        </div>
      </section>
    </div>
  );
}

function Chip({ href, active, children, small = false }: { href: string; active: boolean; children: React.ReactNode; small?: boolean }) {
  return (
    <Link href={href} className={`rounded-full border transition-colors ${small ? "px-3 py-1 text-xs" : "px-3.5 py-1.5 text-sm"}`}
      style={active ? { background: "var(--surface-3)", borderColor: "var(--border-strong)", color: "var(--ink)" } : { background: "var(--surface-1)", color: "var(--ink-muted)" }}>
      {children}
    </Link>
  );
}
