import Link from "next/link";
import { PAY_BANDS, payColor } from "@/lib/payScale";
import { CompanyLogo } from "@/components/CompanyLogo";

export interface IndexRow {
  company: string;
  slug: string;
  sector: string;
  score: number; // Pay Score 0-100 (drives bar in "score" variant)
  value?: string; // optional right-hand figure (e.g. "€99k"); else the score
  barPct?: number; // 0..1, used by the "value" variant to size the bar
}

// Numbeo/index-style ranked table: # | company (mark + name + sector) | bar |
// figure. Two variants — the bar always visualizes the figure next to it:
//  - "score": bar width + color = Pay Score, on the 5-step semantic scale.
//  - "value": bar width = the € figure's rank within the table (row.barPct),
//    neutral fill with a gradient leader; the figure reads plain ink.
// Collapses to #+name+figure under md.
export function PayIndexTable({
  rows, valueHead = "Pay Score", compact = false, variant = "score",
}: { rows: IndexRow[]; valueHead?: string; compact?: boolean; variant?: "score" | "value" }) {
  const pad = compact ? "px-3 py-2" : "px-4 py-2.5";
  return (
    <div className="surface overflow-hidden rounded-card">
 <div className={`tnum flex items-center gap-3 border-b ${pad} text-[11px] text-ink-faint`} style={{ borderColor: "var(--border)" }}>
        <span className="w-6 text-right">#</span>
        <span className="flex-1">Company</span>
        <span className="hidden w-28 md:block lg:w-44">{variant === "value" ? valueHead : "Score"}</span>
        <span className="w-16 text-right">{valueHead}</span>
      </div>
      <ol>
        {rows.map((r, i) => {
          const scoreCol = payColor(r.score);
          const isValue = variant === "value";
          const barW = isValue ? Math.max(3, (r.barPct ?? 0) * 100) : Math.max(3, r.score);
          return (
            <li key={r.slug} className="border-t" style={{ borderColor: "var(--border)" }}>
              <Link href={`/companies/${r.slug}`} className={`flex items-center gap-3 ${pad} transition-colors hover:bg-[var(--band)]`}>
                <span className="tnum w-6 shrink-0 text-right text-sm text-ink-faint">{i + 1}</span>
                <CompanyLogo name={r.company} size={32} />
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="truncate font-medium">{r.company}</span>
                  {!compact && r.sector && (
                    <span className="hidden shrink-0 rounded px-1.5 py-0.5 text-[10px] text-ink-faint sm:inline" style={{ background: "var(--surface-1)" }}>
                      {r.sector}
                    </span>
                  )}
                </span>
                <span className="hidden w-28 md:block lg:w-44">
                  <span className="rank-track block">
                    <span className="rank-fill" style={{ width: `${barW}%`, background: isValue ? (i === 0 ? "var(--accent)" : "var(--border-strong)") : scoreCol }} />
                  </span>
                </span>
                <span className="tnum w-16 shrink-0 text-right font-semibold" style={isValue ? undefined : { color: scoreCol }}>
                  {r.value ?? r.score}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function PayScaleLegend({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] ${className}`}>
      {PAY_BANDS.map((b) => (
        <span key={b.label} className="flex items-center gap-1.5">
          <i className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: b.color }} />
          <span className="text-ink">{b.label}</span>
          <span className="tnum text-ink-faint">{b.range}</span>
        </span>
      ))}
    </div>
  );
}
