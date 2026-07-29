// Annualize a posting's EUR salary midpoint. Returns null if unusable.
export function annualMidpointEur(row: {
  salary_eur_min: number | null;
  salary_eur_max: number | null;
  salary_period: string | null;
}): number | null {
  const lo = row.salary_eur_min;
  const hi = row.salary_eur_max;
  // Reject mixed-unit / unreliable parses: a genuine salary range almost never
  // spans more than ~4x. Big ratios mean the parser grabbed, e.g., a monthly
  // base and an annual commission into one range — garbage, so drop it.
  if (typeof lo === "number" && lo > 0 && typeof hi === "number" && hi > 0 && hi / lo > 4) {
    return null;
  }
  const vals = [lo, hi].filter(
    (v): v is number => typeof v === "number" && v > 0
  );
  if (vals.length === 0) return null;
  let mid = vals.reduce((a, b) => a + b, 0) / vals.length;
  const p = (row.salary_period || "year").toLowerCase();
  // Reinterpret obviously-mislabeled periods: a "monthly" figure above €25k or an
  // "hourly" figure above €400 is really an annual number the parser mis-tagged,
  // so don't multiply it up.
  if (p === "month") mid = mid > 25_000 ? mid : mid * 12;
  else if (p === "hour") mid = mid > 400 ? mid : mid * 1720;
  // Plausibility band for a full-time EMEA annual BASE salary. Below ~€20k is
  // almost always parse noise (a repeated "€1000/mo" perk figure) or an intern
  // stipend, not a professional base; above €500k is sales OTE / mixed units.
  if (mid < 20_000 || mid > 500_000) return null;
  return Math.round(mid);
}

// Linear-interpolated quantile of a SORTED ascending array.
export function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN;
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const next = sorted[base + 1];
  return next !== undefined ? sorted[base] + rest * (next - sorted[base]) : sorted[base];
}

export function median(nums: number[]): number {
  return quantile([...nums].sort((a, b) => a - b), 0.5);
}

export interface Spread {
  n: number;
  p10: number;
  p25: number;
  median: number;
  p75: number;
  p90: number;
}

export function spread(values: number[]): Spread | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  return {
    n: s.length,
    p10: quantile(s, 0.1),
    p25: quantile(s, 0.25),
    median: quantile(s, 0.5),
    p75: quantile(s, 0.75),
    p90: quantile(s, 0.9),
  };
}

// Percentile RANK of a value within a population (0..100).
export function percentileRank(pop: number[], value: number): number {
  if (pop.length === 0) return 50;
  const below = pop.filter((v) => v < value).length;
  const equal = pop.filter((v) => v === value).length;
  return Math.round(((below + 0.5 * equal) / pop.length) * 100);
}
