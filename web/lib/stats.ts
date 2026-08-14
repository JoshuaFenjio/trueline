// Annualize a posting's EUR salary midpoint. Returns null if unusable.
export function annualMidpointEur(row: {
  salary_eur_min: number | null;
  salary_eur_max: number | null;
  salary_period: string | null;
}): number | null {
  let lo = row.salary_eur_min;
  let hi = row.salary_eur_max;
  // Auto-swap an inverted range (min > max) before any ratio check — a swapped
  // pair is a field mix-up, not garbage, and is recoverable.
  if (typeof lo === "number" && typeof hi === "number" && lo > 0 && hi > 0 && lo > hi) {
    [lo, hi] = [hi, lo];
  }
  // Range-width gate, period-aware. A digit-grouping misparse (a tiny bound
  // paired with a large one, e.g. "50"–"80000") is always garbage. Otherwise
  // annual-period ranges may legitimately span up to 4x (director-era ladder
  // bands are wide); monthly/hourly-derived ranges keep the strict 3x, since a
  // wide monthly span is almost always OTE-as-base or a unit mix.
  if (typeof lo === "number" && lo > 0 && typeof hi === "number" && hi > 0) {
    if (lo < 1000 && hi >= 10_000) return null; // digit-grouping misparse
    const annual = (row.salary_period || "year").toLowerCase() === "year";
    if (hi / lo > (annual ? 4 : 3)) return null;
  }
  const vals = [lo, hi].filter(
    (v): v is number => typeof v === "number" && v > 0
  );
  if (vals.length === 0) return null;
  let mid = vals.reduce((a, b) => a + b, 0) / vals.length;
  const p = (row.salary_period || "year").toLowerCase();
  if (p === "month") {
    if (mid > 25_000) {
      // A "monthly" figure above €25k is really an annual number mis-tagged.
    } else {
      mid = mid * 12;
      // A genuine monthly salary that annualizes below ~€35k is almost always a
      // boilerplate perk figure repeated across every role (e.g. "€2,000/month"
      // on a Senior Engineer). Reject rather than pollute the median.
      if (mid < 35_000) return null;
    }
  } else if (p === "hour") {
    if (mid <= 400) mid = mid * 1720;
  }
  // Plausibility band for a full-time EMEA annual BASE salary. Above €500k is
  // sales OTE / mixed units; below €20k is parse noise or an intern stipend.
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

// Trend: median of values dated in the last 90d vs the prior 90d.
export type TrendDir = "up" | "down" | "flat" | "new" | "insufficient";
export interface Trend {
  dir: TrendDir;
  pct: number | null;
  recentN: number;
  priorN: number;
}

const DAY = 86_400_000;

export function computeTrend(items: { dateMs: number; value: number }[], nowMs: number): Trend {
  const recent: number[] = [];
  const prior: number[] = [];
  for (const it of items) {
    if (!it.dateMs) continue;
    const age = nowMs - it.dateMs;
    if (age < 0) continue;
    if (age <= 90 * DAY) recent.push(it.value);
    else if (age <= 180 * DAY) prior.push(it.value);
  }
  if (recent.length < 8) return { dir: "insufficient", pct: null, recentN: recent.length, priorN: prior.length };
  if (prior.length < 8) return { dir: "new", pct: null, recentN: recent.length, priorN: prior.length };
  const mr = median(recent);
  const mp = median(prior);
  const pct = mp > 0 ? ((mr - mp) / mp) * 100 : 0;
  const dir: TrendDir = pct > 2 ? "up" : pct < -2 ? "down" : "flat";
  return { dir, pct, recentN: recent.length, priorN: prior.length };
}
