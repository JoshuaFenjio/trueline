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
      {kicker && <div className="kicker">{kicker}</div>}
      <h2 className="mt-2 text-3xl font-extrabold leading-[1.04] tracking-tight md:text-4xl">
        {title} {accent && <span>{accent}</span>}
      </h2>
      {sub && <p className="mt-3 max-w-2xl text-ink-muted">{sub}</p>}
    </div>
  );
}

// -- Linked section header: icon chip + kicker + title, all one link ----------
// Used by the homepage ranking sections, where the whole header is the way
// through to the matching leaderboard.
export function LinkedSectionHeader({
  href, icon, kicker, title, sub,
}: { href: string; icon: ReactNode; kicker: string; title: string; sub?: string }) {
  return (
    <Link href={href} className="group block w-max max-w-full">
      <div className="flex items-center gap-2.5">
        <span className="icon-chip transition-colors group-hover:bg-[var(--accent)] group-hover:text-white" aria-hidden="true">{icon}</span>
        <span className="kicker">{kicker}</span>
      </div>
      <h2 className="mt-2 flex items-baseline gap-2 text-3xl font-extrabold leading-[1.04] tracking-tight transition-colors group-hover:text-[var(--accent)] md:text-4xl">
        {title}
        <span className="arw text-2xl font-normal text-ink-faint transition-transform group-hover:translate-x-1 group-hover:text-[var(--accent)]">→</span>
      </h2>
      {sub && <p className="mt-3 max-w-2xl text-ink-muted">{sub}</p>}
    </Link>
  );
}

// -- Breadcrumbs: mono trail, last crumb is the current page ------------------
export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-xs text-ink-faint">
      {items.map((it, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-ink-faint/50">/</span>}
          {it.href ? <Link href={it.href} className="hover:text-ink">{it.label}</Link> : <span className="text-ink-muted">{it.label}</span>}
        </span>
      ))}
    </nav>
  );
}

// -- Stat strip: big mono figures + small-caps labels, hairline dividers ------
// 2-up on mobile, N-up from sm; internal hairlines only (no stray edges).
export function StatStrip({ items, className = "" }: { items: { value: ReactNode; label: string }[]; className?: string }) {
  const cols = items.length >= 4 ? "sm:grid-cols-4" : items.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2";
  return (
    <div className={`surface grid grid-cols-2 overflow-hidden rounded-card ${cols} ${className}`}>
      {items.map((it, i) => (
        <div
          key={i}
          className="border-l border-t px-4 py-3.5 [&:nth-child(-n+2)]:border-t-0 [&:nth-child(2n+1)]:border-l-0 sm:border-t-0 sm:[&:nth-child(2n+1)]:border-l sm:first:border-l-0"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="tnum truncate text-2xl font-semibold leading-none md:text-3xl">{it.value}</div>
          <div className="mt-1.5 text-[10px] text-ink-faint">{it.label}</div>
        </div>
      ))}
    </div>
  );
}

// -- Lens card: kicker + title + one line + arrow. First is accent-filled -----
export function LensCard({
  href, kicker, title, line, accent = false,
}: { href: string; kicker: string; title: string; line: string; accent?: boolean }) {
  return (
    <Link href={href} className="group block h-full">
      <div
        className={`flex h-full flex-col justify-between rounded-card border p-5 transition-colors ${accent ? "" : "surface-hover"}`}
        style={accent
          ? { background: "var(--accent-soft)", borderColor: "var(--accent)" }
          : { background: "var(--surface-1)", borderColor: "var(--border)" }}
      >
        <div>
          <div className="text-[10px] text-ink-faint">{kicker}</div>
          <div className="mt-2 text-lg font-semibold tracking-tight">{title}</div>
          <p className="mt-1.5 text-sm text-ink-muted">{line}</p>
        </div>
        <span className="arrow-cue mt-5 inline-flex items-center gap-1 text-[11px]">
          Open <span className="arw">→</span>
        </span>
      </div>
    </Link>
  );
}

// -- Arrow link: mono 11px uppercase, gradient text + arrow +2px on hover -----
export function ArrowLink({ href, children, className = "" }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link href={href} className={`arrow-link inline-flex items-center gap-1 text-xs ${className}`}>
      <span>{children}</span>
      <span className="arw">→</span>
    </Link>
  );
}

// -- Pill button: radius 999 outline, 13px, trailing arrow. "View all", "Explore".
export function PillButton({
  href, children, light = false, className = "",
}: { href: string; children: ReactNode; light?: boolean; className?: string }) {
  return (
    <Link href={href} className={`pill-btn ${light ? "pill-btn-light" : ""} ${className}`}>
      <span>{children}</span>
      <span className="arw">→</span>
    </Link>
  );
}

// -- Icon chip: 28px tinted rounded-square holding a small glyph. -------------
export function IconChip({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`icon-chip ${className}`} aria-hidden="true">{children}</span>;
}

// -- Stat cell: big mono value + small muted label. Building block of strips. --
export function StatCell({ value, label, tone }: { value: ReactNode; label: string; tone?: string }) {
  return (
    <div>
      <div className="tnum text-xl font-semibold leading-none md:text-2xl" style={tone ? { color: tone } : undefined}>{value}</div>
      <div className="mt-1.5 text-[11px] text-ink-faint">{label}</div>
    </div>
  );
}

// -- Section band: consistent vertical rhythm; `tint` adds the full-bleed sage.
// Content stays within the page container (applied at <main>); this only owns
// the band tint + rhythm, never re-pads horizontally.
export function SectionBand({
  children, tint = false, className = "", id,
}: { children: ReactNode; tint?: boolean; className?: string; id?: string }) {
  return (
    <section id={id} className={`${tint ? "band" : ""} section-y ${className}`}>
      {children}
    </section>
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
      <div className="flex items-center px-1 py-2.5 text-[12px] text-ink-faint">
        <span className="w-8 text-right">#</span>
        <span className="ml-4 flex-1">Name</span>
        <span className="mx-4 hidden w-28 sm:block lg:w-40" />
        <span className="w-24 text-right">{valueHead}</span>
      </div>
      <ol>
        {rows.map((r, i) => {
          const inner = (
            <div className="relative flex h-10 items-center px-1 transition-colors hover:bg-[var(--band)]">
              <span className="tnum w-8 shrink-0 text-right text-sm text-ink-faint">{i + 1}</span>
              <span className="ml-4 min-w-0 flex-1 truncate">
                <span className="text-ink">{r.label}</span>
                {r.sub && <span className="tnum ml-2 text-xs text-ink-faint">{r.sub}</span>}
              </span>
              <span className="mx-4 hidden w-28 sm:block lg:w-40">
                <span className="rank-track block">
                  <span className="rank-fill" style={{ width: `${Math.max(3, r.barPct * 100)}%`, background: r.tone ?? "var(--accent)" }} />
                </span>
              </span>
              <span className="tnum w-24 shrink-0 text-right font-semibold tabular-nums" style={r.tone ? { color: r.tone } : undefined}>
                {r.valueLabel}
              </span>
            </div>
          );
          return (
            <li key={r.label + i} className="border-t" style={{ borderColor: "var(--border)" }}>
              {r.href ? <Link href={r.href} className="block">{inner}</Link> : inner}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// Build RankVMs from {label, slug/href, value, n} rows.
export function toPayVMs(
  rows: { label: string; slug?: string; value: number; n: number; note?: string }[],
  hrefBase?: (slug: string) => string
): RankVM[] {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return rows.map((r) => ({
    label: r.label,
    href: hrefBase && r.slug ? hrefBase(r.slug) : undefined,
    sub: r.note ? `${r.n} · ${r.note}` : `${r.n}`,
    valueLabel: eur(r.value),
    barPct: r.value / max,
  }));
}

// Build RankVMs sized by posting volume (count), not €. For "most in demand".
export function toVolumeVMs(
  rows: { name?: string; label?: string; slug: string; n: number }[],
  hrefBase: (slug: string) => string,
  unit = "ads"
): RankVM[] {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return rows.map((r) => ({
    label: (r.label ?? r.name)!,
    href: hrefBase(r.slug),
    valueLabel: `${r.n} ${unit}`,
    barPct: r.n / max,
  }));
}

// -- Trend badge -------------------------------------------------------------
export function TrendBadge({ trend, className = "" }: { trend: Trend; className?: string }) {
  const map: Record<string, { s: string; c: string; t: string }> = {
    up: { s: "▲", c: "var(--mint)", t: trend.pct != null ? `+${Math.round(trend.pct)}%` : "up" },
    down: { s: "▼", c: "var(--ember)", t: trend.pct != null ? `${Math.round(trend.pct)}%` : "down" },
    flat: { s: "→", c: "var(--ink-faint)", t: "flat" },
    new: { s: "▲", c: "var(--accent)", t: "new" },
    insufficient: { s: "", c: "var(--ink-faint)", t: "—" },
  };
  const m = map[trend.dir];
  return (
    <span className={`tnum inline-flex items-center gap-1 text-sm ${className}`} style={{ color: m.c }} title={`${trend.recentN} recent vs ${trend.priorN} prior`}>
      {m.s && <span>{m.s}</span>}<span>{m.t}</span>
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
      <div className="text-[11px] text-ink-faint">Gated · sample too small</div>
      <h3 className="mt-2 text-2xl font-extrabold tracking-tight">
        Not enough reliable pay data <span>yet.</span>
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">
        {tracked && tracked > n ? (
          <>We track <span className="tnum text-ink">{tracked}</span> live role{tracked === 1 ? "" : "s"} for {what}, but only <span className="tnum text-ink">{n}</span> passed our salary checks. </>
        ) : (
          <>We have <span className="tnum text-ink">{n}</span> reliable salaried posting{n === 1 ? "" : "s"} for {what}. </>
        )}
        We show a median at <span className="tnum text-ink">{gate}</span>. We won&rsquo;t invent one.
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
