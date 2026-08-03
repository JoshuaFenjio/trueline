export function eur(n: number | null | undefined, opts?: { round?: number }): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const round = opts?.round ?? 1000;
  const v = Math.round(n / round) * round;
  return "€" + v.toLocaleString("en-IE");
}

export function eurK(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return "€" + (Math.round(n / 1000)).toLocaleString("en-IE") + "k";
}

export function pct(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return Math.round(n) + "%";
}

// Relative "time ago" for the alive/heartbeat signals.
export function timeAgo(iso: string | null): string {
  if (!iso) return "recently";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "recently";
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 90) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} day${d === 1 ? "" : "s"} ago`;
  const mo = Math.floor(d / 30);
  return `${mo} month${mo === 1 ? "" : "s"} ago`;
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
