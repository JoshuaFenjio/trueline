import Link from "next/link";
import { CONCENTRATION_GATE, type MapCity } from "@/lib/data";
import { slugify, eur } from "@/lib/format";

// Ranked "top paying cities" bars — dense, financial-style, light system.
// Bar width ∝ median; value colored vs the EMEA-wide median.
function tone(median: number, emea: number): string {
  const r = emea ? median / emea : 1;
  if (r >= 1.08) return "var(--mint)";
  if (r <= 0.92) return "var(--ember)";
  return "var(--ink)";
}

// excludeConcentrated: drop single-employer markets from the flagship board so
// a one-company cluster (e.g. Cardiff = 100% Monzo) can't read as a "top city".
export function TopCities({ cities, emeaMedian, excludeConcentrated = false }: { cities: MapCity[]; emeaMedian: number; excludeConcentrated?: boolean }) {
  const pool = excludeConcentrated
    ? cities.filter((c) => !c.concentration || c.concentration.share <= CONCENTRATION_GATE)
    : cities;
  const top = [...pool].sort((a, b) => b.median - a.median).slice(0, 12);
  if (top.length === 0) return null;
  const max = Math.max(...top.map((c) => c.median));

  return (
    <div className="surface overflow-hidden rounded-card">
      <div className="tnum flex items-center gap-3 border-b px-4 py-2.5 text-[11px] uppercase tracking-wider text-ink-faint" style={{ borderColor: "var(--border)" }}>
        <span className="w-5 text-right">#</span>
        <span className="flex-1">City</span>
        <span className="w-28 text-right">Median base</span>
        <span className="hidden w-16 text-right sm:block">Roles</span>
      </div>
      <ol>
        {top.map((c, i) => {
          const col = tone(c.median, emeaMedian);
          return (
            <li key={c.slug} className="border-t" style={{ borderColor: "var(--border)" }}>
              <Link href={`/locations/${slugify(c.city)}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--surface-1)]">
                <span className="tnum w-5 text-right text-sm text-ink-faint">{i + 1}</span>
                <span className="flex-1 min-w-0">
                  <span className="truncate">
                    {c.city}
                    {c.concentration && c.concentration.share > CONCENTRATION_GATE && (
                      <span className="ml-2 text-xs text-ink-faint">mostly {c.concentration.company}</span>
                    )}
                  </span>
                  <span className="relative mt-1.5 block h-1.5 overflow-hidden rounded-full" style={{ background: "var(--surface-3)" }}>
                    <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(c.median / max) * 100}%`, background: col === "var(--ink)" ? "var(--border-strong)" : col, opacity: col === "var(--ink)" ? 1 : 0.85 }} />
                  </span>
                </span>
                <span className="tnum w-28 text-right font-semibold" style={{ color: col }}>{eur(c.median)}</span>
                <span className="tnum hidden w-16 text-right text-sm text-ink-faint sm:block">{c.n}</span>
              </Link>
            </li>
          );
        })}
      </ol>
      <div className="tnum flex items-center gap-4 px-4 py-2.5 text-[11px] text-ink-faint">
        <span className="flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-full" style={{ background: "var(--mint)" }} /> above EMEA median</span>
        <span className="flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-full" style={{ background: "var(--ember)" }} /> below</span>
        <span className="ml-auto">EMEA median {eur(emeaMedian)}</span>
      </div>
    </div>
  );
}
