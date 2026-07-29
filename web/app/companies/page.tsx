import Link from "next/link";
import type { Metadata } from "next";
import { getCompaniesBoard, getSectors, isConfigured } from "@/lib/data";
import { Card, ScoreBadge, scoreColor } from "@/components/ui";
import { eur } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Company pay board",
  description:
    "Every EMEA company we track that discloses salaries, scored 0–100 on how their advertised base pay compares to sector peers.",
};

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: { sector?: string; q?: string };
}) {
  if (!isConfigured) return <p className="py-24 text-center text-ink-muted">Supabase not configured.</p>;

  const [board, sectors] = await Promise.all([getCompaniesBoard(), getSectors()]);
  const sector = searchParams.sector;
  const q = (searchParams.q || "").toLowerCase().trim();

  const filtered = board.filter(
    (c) => (!sector || c.sector === sector) && (!q || c.company.toLowerCase().includes(q))
  );

  return (
    <div className="py-12">
      <header className="max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">The pay board</h1>
        <p className="mt-3 text-ink-muted">
          {board.length} EMEA companies that disclose salaries, scored{" "}
          <span className="serif-accent gradient-text">0–100</span> on how their median advertised base compares to
          sector peers. Higher means better-paying for its sector.
        </p>
      </header>

      {/* Controls */}
      <div className="mt-7 flex flex-col gap-4">
        <form method="get" action="/companies" className="flex flex-wrap gap-2">
          {sector && <input type="hidden" name="sector" value={sector} />}
          <input
            name="q" defaultValue={searchParams.q || ""} placeholder="Search company…"
            className="field w-full max-w-xs px-3 py-2.5 text-sm"
          />
        </form>
        <div className="flex flex-wrap gap-2">
          <Chip href="/companies" active={!sector}>All sectors</Chip>
          {sectors.map((s) => (
            <Chip key={s} href={`/companies?sector=${encodeURIComponent(s)}`} active={sector === s}>{s}</Chip>
          ))}
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <p className="mt-10 text-ink-faint">No companies match that filter.</p>
      ) : (
        <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <Link key={c.slug} href={`/companies/${c.slug}`}>
              <Card className="surface-hover h-full transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-lg font-medium">{c.company}</div>
                    <div className="mt-0.5 text-xs text-ink-faint">{c.sector}</div>
                  </div>
                  <ScoreBadge score={c.payScore} />
                </div>
                <div className="mt-4 flex items-end justify-between">
                  <div>
                    <div className="tnum text-xl font-semibold">{eur(c.midpoint)}</div>
                    <div className="text-xs text-ink-faint">median advertised base</div>
                  </div>
                  <div className="tnum text-xs text-ink-faint">{c.n} roles</div>
                </div>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--surface-3)" }}>
                  <div className="h-full rounded-full" style={{ width: `${c.payScore}%`, background: scoreColor(c.payScore) }} />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <p className="mt-8 text-xs text-ink-faint">
        Companies need at least 3 salaried postings to be scored. Pay Score is relative to sector peers, not absolute.
      </p>
    </div>
  );
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-full border px-3.5 py-1.5 text-sm transition-colors"
      style={active
        ? { background: "var(--surface-3)", borderColor: "var(--border-strong)", color: "var(--ink)" }
        : { background: "var(--surface-1)", color: "var(--ink-muted)" }}
    >
      {children}
    </Link>
  );
}
