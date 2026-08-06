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

// Format a figure in its ORIGINAL currency (£68,694 / €95,000 / 450,000 kr).
const CUR_PREFIX: Record<string, string> = { EUR: "€", GBP: "£", USD: "$", CHF: "CHF ", ILS: "₪", TRY: "₺", ZAR: "R" };
const CUR_SUFFIX: Record<string, string> = { SEK: " kr", DKK: " kr", NOK: " kr", PLN: " zł", CZK: " Kč", HUF: " Ft", RON: " lei", AED: " AED", SAR: " SAR" };
export function origPay(amount: number | null | undefined, currency: string): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return "—";
  const c = (currency || "EUR").toUpperCase();
  const n = Math.round(amount).toLocaleString("en-US");
  if (CUR_SUFFIX[c]) return n + CUR_SUFFIX[c];
  return (CUR_PREFIX[c] ?? c + " ") + n;
}

// Compact relative time for dense card rows ("3h", "2d", "just now").
export function timeAgoShort(iso: string | null): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 90) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return `${Math.floor(d / 30)}mo ago`;
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
