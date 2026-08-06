import Link from "next/link";
import type { Metadata } from "next";
import { getCompaniesBoard, getSectors, isConfigured } from "@/lib/data";
import { PayIndexTable, PayScaleLegend, IndexRow } from "@/components/PayIndex";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "The Pay Index",
  description:
    "Every EMEA company we track that discloses salaries, ranked 0–100 on how their advertised base pay compares to sector peers.",
};

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: { sector?: string; q?: string; sort?: string };
}) {
  if (!isConfigured) return <p className="py-24 text-center text-ink-muted">Supabase not configured.</p>;

  const [board, sectors] = await Promise.all([getCompaniesBoard(), getSectors()]);
  const sector = searchParams.sector;
  const q = (searchParams.q || "").toLowerCase().trim();
  const sort = searchParams.sort === "sector" ? "sector" : "score";

  const filtered = board
    .filter((c) => (!sector || c.sector === sector) && (!q || c.company.toLowerCase().includes(q)))
    .sort((a, b) =>
      sort === "sector"
        ? a.sector.localeCompare(b.sector) || b.payScore - a.payScore
        : b.payScore - a.payScore
    );

  const rows: IndexRow[] = filtered.map((c) => ({
    company: c.company, slug: c.slug, sector: c.sector, score: c.payScore,
  }));

  const qs = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { sector, q: searchParams.q, sort: searchParams.sort, ...extra };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return `/companies${s ? `?${s}` : ""}`;
  };

  return (
    <div className="py-12">
      <header className="max-w-3xl">
        <div className="tnum text-[11px] uppercase tracking-[0.2em] text-ink-faint">The Pay Index</div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
          Top companies · Pay Ranking
        </h1>
        <p className="mt-3 text-ink-muted">
          {board.length} EMEA companies that disclose salaries, ranked 0–100 on how their median
          advertised base compares to sector peers. Higher means better-paying for its sector.
        </p>
      </header>

      {/* Controls */}
      <div className="mt-7 flex flex-col gap-4">
        <form method="get" action="/companies" className="flex flex-wrap gap-2">
          {sector && <input type="hidden" name="sector" value={sector} />}
          {searchParams.sort && <input type="hidden" name="sort" value={searchParams.sort} />}
          <input
            name="q" defaultValue={searchParams.q || ""} placeholder="Search company…"
            className="field w-full max-w-xs px-3 py-2.5 text-sm"
          />
        </form>
        <div className="flex flex-wrap items-center gap-2">
          <Chip href={qs({ sector: undefined })} active={!sector}>All sectors</Chip>
          {sectors.map((s) => (
            <Chip key={s} href={qs({ sector: s })} active={sector === s}>{s}</Chip>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs text-ink-faint">
          <span>Sort</span>
          <Chip href={qs({ sort: undefined })} active={sort === "score"} small>Pay Score</Chip>
          <Chip href={qs({ sort: "sector" })} active={sort === "sector"} small>Sector</Chip>
          <span className="ml-auto tnum">{filtered.length} ranked</span>
        </div>
      </div>

      {/* Ranking */}
      {rows.length === 0 ? (
        <p className="mt-10 text-ink-faint">No companies match that filter.</p>
      ) : (
        <div className="mt-6">
          <PayIndexTable rows={rows} />
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
            <span className="text-[11px] uppercase tracking-wider text-ink-faint">Scale</span>
            <PayScaleLegend />
          </div>
        </div>
      )}

      <p className="mt-8 text-xs text-ink-faint">
        Companies need at least 3 salaried postings to be ranked. Pay Score is relative to sector peers, not absolute.
      </p>
    </div>
  );
}

function Chip({ href, active, children, small = false }: { href: string; active: boolean; children: React.ReactNode; small?: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-full border transition-colors ${small ? "px-3 py-1 text-xs" : "px-3.5 py-1.5 text-sm"}`}
      style={active
        ? { background: "var(--surface-3)", borderColor: "var(--border-strong)", color: "var(--ink)" }
        : { background: "var(--surface-1)", color: "var(--ink-muted)" }}
    >
      {children}
    </Link>
  );
}
