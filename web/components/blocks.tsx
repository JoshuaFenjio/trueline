import Link from "next/link";
import { ReactNode } from "react";
import { eur, eurK } from "@/lib/format";
import { Trend } from "@/lib/stats";

// -- Section header: mono kicker + tight Geist 800 headline + 1 serif word ----
export function SectionHeader({
  kicker, title, accent, sub, id,
}: { kicker?: string; title: ReactNode; accent?: string; sub?: ReactNode; id?: string }) {
  return (
    <div id={id} className="scroll-mt-24">
      {kicker && <div className="tnum text-[11px] uppercase tracking-[0.22em] text-ink-faint">{kicker}</div>}
      <h2 className="mt-2 text-3xl font-extrabold leading-[1.04] tracking-tight md:text-4xl">
        {title} {accent && <span>{accent}</span>}
      </h2>
      {sub && <p className="mt-3 max-w-2xl text-ink-muted">{sub}</p>}
    </div>
  );
}

// -- Arrow link: mono 11px uppercase, gradient text + arrow +2px on hover -----
export function ArrowLink({ href, children, className = "" }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link href={href} className={`arrow-link inline-flex items-center gap-1 text-[11px] uppercase tracking-wider ${className}`}>
      <span>{children}</span>
      <span className="arw">→</span>
    </Link>
  );
}

// -- Full-bleed ranked table with hairline rules + relative-pay underlay ------
export interface RankVM {
  label: string;
  href?: string;
  sub?: string;
  valueLabel: string;
  barPct: number; // 0..1 relative to the leader
  tone?: string; // optional value color
}

export function RankTable({ rows, valueHead = "Median base" }: { rows: RankVM[]; valueHead?: string }) {
  return (
    <div className="border-y" style={{ borderColor: "var(--border)" }}>
      <div className="tnum flex items-center px-1 py-2 text-[11px] uppercase tracking-wider text-ink-faint">
        <span className="w-8 text-right">#</span>
        <span className="ml-4 flex-1">Name</span>
        <span className="text-right">{valueHead}</span>
      </div>
      <ol>
        {rows.map((r, i) => {
          const inner = (
            <div className="relative flex items-center px-1 py-3.5 transition-colors hover:bg-[var(--surface-2)]">
              <div
                className="pointer-events-none absolute inset-y-1 left-0 -z-10 rounded-r-md"
                style={{ width: `${Math.max(2, r.barPct * 100)}%`, background: "linear-gradient(90deg, rgba(124,108,255,.14), rgba(78,201,255,.05))" }}
              />
              <span className="tnum w-8 text-right text-sm text-ink-faint">{i + 1}</span>
              <span className="ml-4 flex-1 truncate">
                <span className="text-ink">{r.label}</span>
                {r.sub && <span className="tnum ml-2 text-xs text-ink-faint">{r.sub}</span>}
              </span>
              <span className="tnum text-right font-semibold" style={r.tone ? { color: r.tone } : undefined}>
                {r.valueLabel}
              </span>
            </div>
          );
          return (
            <li key={r.label + i} className="border-t" style={{ borderColor: "var(--border)" }}>
              {r.href ? <Link href={r.href}>{inner}</Link> : inner}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// Build RankVMs from {label, slug/href, value, n} rows.
export function toPayVMs(
  rows: { label: string; slug?: string; value: number; n: number }[],
  hrefBase?: (slug: string) => string
): RankVM[] {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return rows.map((r) => ({
    label: r.label,
    href: hrefBase && r.slug ? hrefBase(r.slug) : undefined,
    sub: `${r.n}`,
    valueLabel: eur(r.value),
    barPct: r.value / max,
  }));
}

// -- Trend badge -------------------------------------------------------------
export function TrendBadge({ trend, className = "" }: { trend: Trend; className?: string }) {
  const map: Record<string, { s: string; c: string; t: string }> = {
    up: { s: "▲", c: "var(--mint)", t: trend.pct != null ? `+${Math.round(trend.pct)}%` : "up" },
    down: { s: "▼", c: "var(--ember)", t: trend.pct != null ? `${Math.round(trend.pct)}%` : "down" },
    flat: { s: "→", c: "var(--ink-faint)", t: "flat" },
    new: { s: "▲", c: "#5E8BFF", t: "new" },
    insufficient: { s: "·", c: "var(--ink-faint)", t: "—" },
  };
  const m = map[trend.dir];
  return (
    <span className={`tnum inline-flex items-center gap-1 text-sm ${className}`} style={{ color: m.c }} title={`${trend.recentN} recent vs ${trend.priorN} prior`}>
      <span>{m.s}</span><span>{m.t}</span>
    </span>
  );
}

// -- Level ladder (junior -> staff+) -----------------------------------------
export function LevelLadder({ items }: { items: { level: string; median: number | null; n: number }[] }) {
  const max = Math.max(1, ...items.map((i) => i.median || 0));
  return (
    <div className="space-y-2.5">
      {items.map((it) => (
        <div key={it.level} className="flex items-center gap-3">
          <span className="w-16 text-sm text-ink-muted">{it.level}</span>
          <div className="relative h-7 flex-1 overflow-hidden rounded-lg" style={{ background: "var(--surface-2)" }}>
            {it.median != null && (
              <div className="absolute inset-y-0 left-0 rounded-lg gradient-bg" style={{ width: `${((it.median || 0) / max) * 100}%` }} />
            )}
          </div>
          <span className="tnum w-24 text-right text-sm font-semibold">
            {it.median != null ? eur(it.median) : <span className="font-normal text-ink-faint">{it.n}/8</span>}
          </span>
        </div>
      ))}
    </div>
  );
}

// -- Designed empty (gated) state --------------------------------------------
export function GatedState({ n, gate = 8, what, tracked }: { n: number; gate?: number; what: string; tracked?: number }) {
  const pct = Math.min(100, (n / gate) * 100);
  return (
    <div className="surface rounded-card p-8 text-center">
      <div className="tnum text-[11px] uppercase tracking-[0.22em] text-ink-faint">Gated · sample too small</div>
      <h3 className="mt-2 text-2xl font-extrabold tracking-tight">
        Not enough reliable pay data <span>yet.</span>
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">
        {tracked && tracked > n ? (
          <>We track <span className="tnum text-ink">{tracked}</span> live role{tracked === 1 ? "" : "s"} for {what}, but only <span className="tnum text-ink">{n}</span> passed our salary checks. </>
        ) : (
          <>We have <span className="tnum text-ink">{n}</span> reliable salaried posting{n === 1 ? "" : "s"} for {what}. </>
        )}
        The median unlocks at <span className="tnum text-ink">{gate}</span>. We won&apos;t invent one.
      </p>
      <div className="mx-auto mt-5 h-2 max-w-xs overflow-hidden rounded-full" style={{ background: "var(--surface-3)" }}>
        <div className="h-full rounded-full gradient-bg" style={{ width: `${pct}%` }} />
      </div>
      <div className="tnum mt-2 text-xs text-ink-faint">{n} / {gate}</div>
    </div>
  );
}

// -- Chip -------------------------------------------------------------------
export function Chip({ href, children, active = false }: { href: string; children: ReactNode; active?: boolean }) {
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

export { eur, eurK };
