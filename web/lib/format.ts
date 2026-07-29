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

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
