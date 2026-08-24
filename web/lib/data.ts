import "server-only";
import { unstable_cache } from "next/cache";
import { getSupabase, isConfigured } from "./supabase";
import {
  annualMidpointEur, spread, percentileRank, median, Spread, computeTrend, Trend,
} from "./stats";
import { levelBucket, isTrainee, Level, LEVELS } from "./levels";
import { sectorOf, Sector } from "./sectors";
import { resolvePlace } from "./geo";
import { iso2 } from "./flags";
import { slugify, eur as eurFmt } from "./format";

export { isConfigured };

// ---------------------------------------------------------------------------
// Enriched posting + the single cached fetch (hourly revalidate)
// ---------------------------------------------------------------------------
export interface Posting {
  company: string;
  sector: Sector;
  roleFamily: string;
  level: Level;
  city: string | null;
  country: string | null;
  remote: boolean;
  annual: number | null; // usable base for stats, or null
  disclosed: boolean; // ad stated any salary (source !== none)
  multiMarket: boolean; // spans an EMEA and a non-EMEA office
  url: string | null;
  dateMs: number; // posted_at parsed (temporal signal for trends)
}

function parseDate(s: string | null): number {
  if (!s) return 0;
  const t = Date.parse(s);
  return Number.isNaN(t) ? 0 : t;
}

// Currencies we trust as genuine EMEA base pay. A salary quoted in any other
// currency on an (already EMEA-only) posting is US/global-band leakage — e.g.
// Wolt publishing USD bands on Athens roles, ElevenLabs global USD across the
// EU — not the local market, so we don't count it in medians or Pay Scores.
const EMEA_CURRENCIES = new Set([
  "EUR", "GBP", "CHF", "SEK", "DKK", "NOK", "PLN", "CZK", "HUF", "RON", "BGN",
  "HRK", "ISK", "ILS", "AED", "SAR", "QAR", "KWD", "BHD", "OMR", "EGP", "ZAR",
  "NGN", "KES", "MAD", "TND", "TRY", "UAH", "GEL", "RSD",
]);

const _fetch = unstable_cache(
  async (): Promise<Posting[]> => {
    const sb = getSupabase();
    if (!sb) return [];
    const all: any[] = [];
    const PAGE = 1000;
    for (let from = 0; from < 10000; from += PAGE) {
      const { data, error } = await sb
        .from("job_postings")
        .select(
          "company,role_family,title,city,location,country,remote,salary_eur_min,salary_eur_max,salary_period,salary_source,currency,url,posted_at,region,multi_market"
        )
        .eq("status", "active")
        .range(from, from + PAGE - 1);
      if (error || !data || data.length === 0) break;
      all.push(...data);
      if (data.length < PAGE) break;
    }
    return all
      .map((r): Posting | null => {
        // region / multi_market are tagged by the pipeline (see classify_region)
        // and stored in Supabase — read them directly, no recompute.
        const multiMarket = r.multi_market === true;
        // Non-EMEA rows (e.g. "Lake Zurich, Illinois") are excluded entirely.
        if (r.region === "NONEMEA") return null;

        // 'parsed_suspect' rows disclosed a number our parser couldn't trust
        // (OTE-as-base, inverted, or digit-grouping misparse) — treat as if no
        // salary was stated: excluded from medians AND from transparency %.
        const disclosed = r.salary_source && r.salary_source !== "none" && r.salary_source !== "parsed_suspect";
        let annual = disclosed ? annualMidpointEur(r) : null;
        // Reject non-EMEA-currency salaries as EMEA base pay. Applies to every
        // posting, not just multi-market ones: a single-location Athens role
        // priced in USD is a US band leaking onto a European posting, so it must
        // not enter medians/Pay Scores. Null currency defaults to EUR (kept).
        if (annual !== null && !EMEA_CURRENCIES.has((r.currency || "EUR").toUpperCase()))
          annual = null;
        // Intern / working-student / apprentice pay is a stipend — keep the row
        // (still counts as disclosed) but exclude it from salary medians.
        if (annual !== null && isTrainee(r.title)) annual = null;

        const place = resolvePlace(r.city || r.location, r.country);
        return {
          company: r.company,
          sector: sectorOf(r.company),
          roleFamily: r.role_family || "Other",
          level: levelBucket(r.title),
          city: place.city,
          country: place.country,
          remote: place.remote || !!r.remote,
          annual,
          disclosed: !!disclosed,
          multiMarket,
          url: r.url || null,
          dateMs: parseDate(r.posted_at),
        };
      })
      .filter((p): p is Posting => p !== null);
  },
  ["trueline-active-v11"],
  { revalidate: 3600 }
);

export async function getData(): Promise<Posting[]> {
  return _fetch();
}

const usable = (rows: Posting[]) => rows.filter((r) => r.annual !== null) as (Posting & { annual: number })[];

// Gates
const N_MEDIAN = 8;
const N_COMPANY = 3;
// Flagship gate: the map insight card's #1 country slot needs a deeper sample
// than the standard median gate before we headline it as the top payer. Below
// this, the insight features the highest-median country that does clear it.
const N_FLAGSHIP = 15;

// A market where one employer supplies most postings is real data but a
// misleading "market" rate. Flag > 60% single-company concentration.
export { CONCENTRATION_GATE } from "./payScale";
export interface Concentration { company: string; share: number }
function topCompanyShare(rows: { company: string }[]): Concentration | null {
  if (rows.length === 0) return null;
  const c = new Map<string, number>();
  for (const r of rows) c.set(r.company, (c.get(r.company) || 0) + 1);
  let company = "", n = 0;
  for (const [co, k] of c) if (k > n) { company = co; n = k; }
  return { company, share: n / rows.length };
}

// ---------------------------------------------------------------------------
// Generic slice
// ---------------------------------------------------------------------------
export interface Slice {
  spread: Spread | null;
  n: number;
  gated: boolean;
}
export function sliceOf(rows: Posting[], pred: (p: Posting) => boolean): Slice {
  const vals = usable(rows).filter(pred).map((r) => r.annual);
  const sp = spread(vals);
  const gated = !sp || sp.n < N_MEDIAN;
  return { spread: gated ? null : sp, n: vals.length, gated };
}

// ---------------------------------------------------------------------------
// Latest refresh timestamp (alive signal) — max(last_seen) across postings.
// ---------------------------------------------------------------------------
export const getLastRefreshed = unstable_cache(
  async (): Promise<string | null> => {
    const sb = getSupabase();
    if (!sb) return null;
    const { data } = await sb
      .from("job_postings")
      .select("last_seen")
      .order("last_seen", { ascending: false })
      .limit(1);
    return (data?.[0] as any)?.last_seen ?? null;
  },
  ["trueline-last-refreshed"],
  { revalidate: 600 }
);

// ---------------------------------------------------------------------------
// Live stats (home pill)
// ---------------------------------------------------------------------------
export const getLiveStats = async () => {
  const rows = await getData();
  const u = usable(rows);
  return {
    companies: new Set(rows.map((r) => r.company)).size,
    postings: rows.length, // total live EMEA roles we track
    disclosed: rows.filter((r) => r.disclosed).length, // published a salary
    salaried: u.length, // disclosed AND usable for a median
    cities: new Set(u.map((r) => r.city).filter(Boolean)).size,
  };
};

// ---------------------------------------------------------------------------
// Company stats + board
// ---------------------------------------------------------------------------
export interface CompanyStat {
  company: string; slug: string; sector: Sector;
  midpoint: number; n: number; activeN: number; disclosedN: number; disclosurePct: number;
  payScore: number; sectorRank: number; sectorTotal: number; trend: Trend;
}

function midpointByCompany(rows: Posting[]) {
  const m = new Map<string, number[]>();
  for (const r of usable(rows)) {
    const a = m.get(r.company) || []; a.push(r.annual); m.set(r.company, a);
  }
  return m;
}

export const getCompaniesBoard = async (): Promise<CompanyStat[]> => {
  const rows = await getData();
  const now = Date.now();
  const midpoints = midpointByCompany(rows);
  const activeByCompany = new Map<string, Posting[]>();
  for (const r of rows) {
    const a = activeByCompany.get(r.company) || []; a.push(r); a && activeByCompany.set(r.company, a);
  }

  const base = [...midpoints.entries()]
    .filter(([, v]) => v.length >= N_COMPANY)
    .map(([company, v]) => {
      const active = activeByCompany.get(company) || [];
      const disclosedN = active.filter((p) => p.disclosed).length;
      const trend = computeTrend(
        usable(active).map((p) => ({ dateMs: p.dateMs, value: p.annual })), now
      );
      return {
        company, slug: slugify(company), sector: sectorOf(company),
        midpoint: median(v), n: v.length, activeN: active.length, disclosedN,
        disclosurePct: active.length ? Math.round((disclosedN / active.length) * 100) : 0,
        trend,
      };
    });

  // Pay Score + sector rank within sector peers.
  const bySector = new Map<Sector, typeof base>();
  for (const c of base) {
    const a = (bySector.get(c.sector) || []) as typeof base; a.push(c); bySector.set(c.sector, a);
  }
  const withScore: CompanyStat[] = base.map((c) => {
    const peers = bySector.get(c.sector)!;
    const peerMids = peers.map((p) => p.midpoint);
    const ranked = [...peers].sort((a, b) => b.midpoint - a.midpoint);
    return {
      ...c,
      payScore: percentileRank(peerMids, c.midpoint),
      sectorRank: ranked.findIndex((p) => p.company === c.company) + 1,
      sectorTotal: peers.length,
    };
  });
  return withScore.sort((a, b) => b.midpoint - a.midpoint);
};

// ---------------------------------------------------------------------------
// Lists / reverse lookups
// ---------------------------------------------------------------------------
export const getRoleFamilies = async (): Promise<string[]> => {
  const rows = await getData();
  const c = new Map<string, number>();
  for (const r of usable(rows)) c.set(r.roleFamily, (c.get(r.roleFamily) || 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
};
export const getCityList = async (): Promise<{ city: string; n: number }[]> => {
  const rows = await getData();
  const c = new Map<string, number>();
  for (const r of usable(rows)) if (r.city) c.set(r.city, (c.get(r.city) || 0) + 1);
  return [...c.entries()].map(([city, n]) => ({ city, n })).sort((a, b) => b.n - a.n);
};
export const getCountryList = async (): Promise<{ country: string; n: number }[]> => {
  const rows = await getData();
  const c = new Map<string, number>();
  for (const r of usable(rows)) if (r.country) c.set(r.country, (c.get(r.country) || 0) + 1);
  return [...c.entries()].map(([country, n]) => ({ country, n })).sort((a, b) => b.n - a.n);
};

// Index rows for the hub pages: every entity with its posting count and a
// gated median (null under N_MEDIAN, so we never invent a number).
export interface IndexEntity { name: string; slug: string; n: number; median: number | null; concentration: Concentration | null; }
function indexBy(rows: Posting[], key: (p: Posting) => string | null): IndexEntity[] {
  const m = new Map<string, (Posting & { annual: number })[]>();
  for (const r of usable(rows)) {
    const k = key(r); if (!k) continue;
    const a = m.get(k) || []; a.push(r); m.set(k, a);
  }
  return [...m.entries()]
    .map(([name, rs]) => ({
      name, slug: slugify(name), n: rs.length,
      median: rs.length >= N_MEDIAN ? Math.round(median(rs.map((r) => r.annual))) : null,
      concentration: topCompanyShare(rs),
    }))
    .sort((a, b) => (b.median ?? 0) - (a.median ?? 0) || b.n - a.n);
}
export const getRoleIndex = async (): Promise<IndexEntity[]> => indexBy(await getData(), (p) => p.roleFamily);
// Most-active roles by new postings in the last 30 days (real recency signal).
export const getRoleActivity = async (): Promise<{ role: string; slug: string; recentN: number }[]> => {
  const rows = await getData();
  const now = Date.now(), cutoff = now - 30 * 24 * 60 * 60 * 1000;
  const m = new Map<string, number>();
  for (const p of rows) {
    if (!p.roleFamily || p.roleFamily === "Other" || !p.dateMs || p.dateMs < cutoff || p.dateMs > now) continue;
    m.set(p.roleFamily, (m.get(p.roleFamily) || 0) + 1);
  }
  return [...m.entries()].map(([role, recentN]) => ({ role, slug: slugify(role), recentN })).sort((a, b) => b.recentN - a.recentN);
};
export const getCountryIndex = async (): Promise<IndexEntity[]> => indexBy(await getData(), (p) => p.country);
export const getCityIndex = async (): Promise<IndexEntity[]> => indexBy(await getData(), (p) => p.city);

// Europe pay map — per-role country medians + top payers, for the choropleth.
export interface CountryPay { country: string; median: number | null; n: number; topPayers: { company: string; median: number }[]; concentration: Concentration | null; }
export interface RolePay { emeaMedian: number; countries: CountryPay[]; }
export interface EuropePayData { roles: string[]; data: Record<string, RolePay>; }

function rolePay(rows: (Posting & { annual: number })[]): RolePay {
  const emeaMedian = rows.length ? Math.round(median(rows.map((r) => r.annual))) : 0;
  const byCountry = new Map<string, (Posting & { annual: number })[]>();
  for (const r of rows) {
    if (!r.country) continue;
    const a = byCountry.get(r.country) || []; a.push(r); byCountry.set(r.country, a);
  }
  const countries: CountryPay[] = [];
  for (const [country, ps] of byCountry) {
    const byCo = new Map<string, number[]>();
    for (const p of ps) { const a = byCo.get(p.company) || []; a.push(p.annual); byCo.set(p.company, a); }
    const topPayers = [...byCo.entries()]
      .filter(([, v]) => v.length >= N_COMPANY)
      .map(([company, v]) => ({ company, median: Math.round(median(v)) }))
      .sort((a, b) => b.median - a.median).slice(0, 3);
    countries.push({ country, n: ps.length, median: ps.length >= N_MEDIAN ? Math.round(median(ps.map((p) => p.annual))) : null, topPayers, concentration: topCompanyShare(ps) });
  }
  return { emeaMedian, countries };
}

export const getEuropePayData = async (): Promise<EuropePayData> => {
  const all = usable(await getData());
  const roles = await getRoleFamilies();
  const data: Record<string, RolePay> = { "All roles": rolePay(all) };
  for (const role of roles) data[role] = rolePay(all.filter((r) => r.roleFamily === role));
  return { roles, data };
};

// Salaried postings per sector — for the homepage sector chip row.
export const getSectorCounts = async (): Promise<{ sector: Sector; n: number }[]> => {
  const rows = await getData();
  const m = new Map<Sector, number>();
  for (const r of usable(rows)) m.set(r.sector, (m.get(r.sector) || 0) + 1);
  return [...m.entries()].map(([sector, n]) => ({ sector, n })).sort((a, b) => b.n - a.n);
};

// Most-recent salaried postings, in their ORIGINAL currency, for the live
// proof-of-life cards on the homepage fold.
export interface LiveCard {
  company: string; slug: string; role: string; city: string;
  currency: string; amount: number; postedAt: string | null;
}
export const getRecentSalaried = unstable_cache(
  async (): Promise<LiveCard[]> => {
    const sb = getSupabase();
    if (!sb) return [];
    const { data } = await sb
      .from("job_postings")
      .select("company,role_family,title,city,location,country,salary_min,salary_max,salary_period,salary_eur_min,salary_eur_max,currency,posted_at,region,multi_market")
      .eq("status", "active").neq("salary_source", "none")
      .not("salary_min", "is", null).not("posted_at", "is", null)
      .order("posted_at", { ascending: false })
      .limit(200);
    const out: LiveCard[] = [];
    const seen = new Set<string>();
    for (const r of (data as any[]) || []) {
      if (r.region === "NONEMEA") continue;
      if (isTrainee(r.title)) continue;
      // Annual postings only — sidesteps noisy month/hour period tags so every
      // figure on the flagship row is unambiguous and correct as shown.
      if ((r.salary_period || "year").toLowerCase() !== "year") continue;
      // EMEA-currency only — keep the proof-of-life row on-brand (no USD leaks).
      if (!EMEA_CURRENCIES.has((r.currency || "").toUpperCase())) continue;
      const eLo = r.salary_eur_min, eHi = r.salary_eur_max || r.salary_eur_min;
      if (!eLo || eLo < 25_000) continue;
      const eMid = (eLo + eHi) / 2;
      if (eMid > 300_000) continue; // implausible base for a single role
      if (eHi / eLo > 4) continue; // mixed-unit / bad-parse noise (ratio gate)
      const lo = r.salary_min, hi = r.salary_max || r.salary_min;
      if (!lo || lo <= 0) continue;
      if (seen.has(r.company)) continue; // one card per company for variety
      seen.add(r.company);
      const place = resolvePlace(r.city || r.location, r.country);
      out.push({
        company: r.company, slug: slugify(r.company),
        role: r.role_family || "Role", city: place.city || place.country || "Remote",
        currency: (r.currency || "EUR").toUpperCase(),
        amount: Math.round((lo + (hi || lo)) / 2),
        postedAt: r.posted_at || null,
      });
      if (out.length >= 6) break;
    }
    return out;
  },
  ["trueline-recent-v4"],
  { revalidate: 1800 }
);
// Entities that exist in the data at all (>= threshold ACTIVE postings), even
// if their salary data is currently gated. Used so legit markets resolve to a
// designed empty state instead of a hard 404.
const PRESENCE = 8;
async function activeNames(kind: "city" | "country"): Promise<string[]> {
  const rows = await getData();
  const c = new Map<string, number>();
  for (const r of rows) {
    const k = kind === "city" ? r.city : r.country;
    if (k) c.set(k, (c.get(k) || 0) + 1);
  }
  return [...c.entries()].filter(([, n]) => n >= PRESENCE).map(([k]) => k);
}

export async function roleFromSlug(slug: string): Promise<string | null> {
  const rows = await getData();
  const roles = [...new Set(rows.map((r) => r.roleFamily))];
  return roles.find((r) => slugify(r) === slug) || null;
}
export async function cityFromSlug(slug: string): Promise<string | null> {
  return (await activeNames("city")).find((c) => slugify(c) === slug) || null;
}
export async function countryFromSlug(slug: string): Promise<string | null> {
  return (await activeNames("country")).find((c) => slugify(c) === slug) || null;
}

// ---------------------------------------------------------------------------
// Ranked helpers (companies / cities / countries) with gates
// ---------------------------------------------------------------------------
export interface RankRow { key: string; label: string; slug: string; value: number; n: number; }

function rankCompaniesBy(rows: Posting[], pred: (p: Posting) => boolean, gate = N_COMPANY): RankRow[] {
  const m = new Map<string, number[]>();
  for (const r of usable(rows).filter(pred)) {
    const a = m.get(r.company) || []; a.push(r.annual); m.set(r.company, a);
  }
  return [...m.entries()].filter(([, v]) => v.length >= gate)
    .map(([company, v]) => ({ key: company, label: company, slug: slugify(company), value: median(v), n: v.length }))
    .sort((a, b) => b.value - a.value);
}
function rankCitiesBy(rows: Posting[], pred: (p: Posting) => boolean, gate = N_MEDIAN): RankRow[] {
  const m = new Map<string, number[]>();
  for (const r of usable(rows).filter(pred)) {
    if (!r.city) continue;
    const a = m.get(r.city) || []; a.push(r.annual); m.set(r.city, a);
  }
  return [...m.entries()].filter(([, v]) => v.length >= gate)
    .map(([city, v]) => ({ key: city, label: city, slug: slugify(city), value: median(v), n: v.length }))
    .sort((a, b) => b.value - a.value);
}
function rankCountriesBy(rows: Posting[], pred: (p: Posting) => boolean, gate = N_MEDIAN): RankRow[] {
  const m = new Map<string, number[]>();
  for (const r of usable(rows).filter(pred)) {
    if (!r.country) continue;
    const a = m.get(r.country) || []; a.push(r.annual); m.set(r.country, a);
  }
  return [...m.entries()].filter(([, v]) => v.length >= gate)
    .map(([country, v]) => ({ key: country, label: country, slug: slugify(country), value: median(v), n: v.length }))
    .sort((a, b) => b.value - a.value);
}

// ---------------------------------------------------------------------------
// Leaderboards
// ---------------------------------------------------------------------------
export interface Leaderboards {
  topCompanies: RankRow[];
  bySector: { sector: Sector; rows: RankRow[] }[];
  byRole: { role: string; rows: RankRow[] }[];
  bestDisclosure: { company: string; slug: string; pct: number; activeN: number }[];
  roles: string[];
}

export const getLeaderboards = async (): Promise<Leaderboards> => {
  const rows = await getData();
  const roles = await getRoleFamilies();

  const topCompanies = rankCompaniesBy(rows, () => true).slice(0, 20);

  const bySector = (["AI", "Fintech", "Devtools", "SaaS", "Consumer", "Health", "Security", "Mobility"] as Sector[])
    .map((sector) => ({ sector, rows: rankCompaniesBy(rows, (p) => p.sector === sector).slice(0, 8) }))
    .filter((s) => s.rows.length > 0);

  const byRole = roles
    .map((role) => ({ role, rows: rankCompaniesBy(rows, (p) => p.roleFamily === role).slice(0, 8) }))
    .filter((r) => r.rows.length > 0);

  // Best disclosure — companies with a meaningful number of active ads.
  const activeByCompany = new Map<string, Posting[]>();
  for (const r of rows) { const a = activeByCompany.get(r.company) || []; a.push(r); activeByCompany.set(r.company, a); }
  const bestDisclosure = [...activeByCompany.entries()]
    .filter(([, v]) => v.length >= 10)
    .map(([company, v]) => ({
      company, slug: slugify(company),
      pct: Math.round((v.filter((p) => p.disclosed).length / v.length) * 100),
      activeN: v.length,
    }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 15);

  return { topCompanies, bySector, byRole, bestDisclosure, roles };
};

// Countries ranked for a given role (leaderboard "which countries pay most").
export async function countriesForRole(role: string): Promise<RankRow[]> {
  const rows = await getData();
  return rankCountriesBy(rows, (p) => p.roleFamily === role);
}

// Country leaderboard — median base (gated n>=8) + transparency % (disclosed of
// tracked, at country level) + flag code. Sorted by median. All live-derived.
export interface CountryRank { country: string; code: string | null; median: number; n: number; disclosurePct: number; trackedN: number }
export const getCountryLeaderboard = async (): Promise<CountryRank[]> => {
  const rows = await getData();
  const byCountry = new Map<string, Posting[]>();
  for (const r of rows) { if (!r.country) continue; const a = byCountry.get(r.country) || []; a.push(r); byCountry.set(r.country, a); }
  const out: CountryRank[] = [];
  for (const [country, rs] of byCountry) {
    const sal = rs.filter((p) => p.annual !== null) as (Posting & { annual: number })[];
    if (sal.length < N_MEDIAN) continue;
    const disclosed = rs.filter((p) => p.disclosed).length;
    out.push({
      country, code: iso2(country), median: Math.round(median(sal.map((r) => r.annual))),
      n: sal.length, trackedN: rs.length,
      disclosurePct: rs.length ? Math.round((disclosed / rs.length) * 100) : 0,
    });
  }
  return out.sort((a, b) => b.median - a.median);
};

// ---------------------------------------------------------------------------
// Role hub
// ---------------------------------------------------------------------------
export interface RoleHub {
  role: string; slug: string;
  overall: Slice; trackedN: number; disclosedN: number;
  byLevel: { level: Level; slice: Slice }[];
  topCities: RankRow[]; topCountries: RankRow[]; topCompanies: RankRow[];
  trend: Trend;
  dist: number[]; // sorted salaried annual base values, for the distribution curve
}
export async function getRoleHub(role: string): Promise<RoleHub> {
  const rows = await getData();
  const inRole = (p: Posting) => p.roleFamily === role;
  return {
    role, slug: slugify(role),
    overall: sliceOf(rows, inRole),
    trackedN: rows.filter(inRole).length,
    disclosedN: rows.filter((p) => inRole(p) && p.disclosed).length,
    byLevel: LEVELS.map((level) => ({ level, slice: sliceOf(rows, (p) => inRole(p) && p.level === level) })),
    topCities: rankCitiesBy(rows, inRole).slice(0, 10),
    topCountries: rankCountriesBy(rows, inRole).slice(0, 10),
    topCompanies: rankCompaniesBy(rows, inRole).slice(0, 10),
    trend: computeTrend(usable(rows).filter(inRole).map((p) => ({ dateMs: p.dateMs, value: p.annual })), Date.now()),
    dist: usable(rows).filter(inRole).map((p) => p.annual).sort((a, b) => a - b),
  };
}

// ---------------------------------------------------------------------------
// Location hubs (city + country)
// ---------------------------------------------------------------------------
export interface LocationHub {
  name: string; slug: string; kind: "city" | "country";
  overall: Slice; trackedN: number; disclosedN: number;
  byRole: RankRow[]; topPayers: RankRow[];
  rank: { pos: number; total: number } | null;
  trend: Trend;
}

async function locationHub(name: string, kind: "city" | "country"): Promise<LocationHub> {
  const rows = await getData();
  const match = (p: Posting) => (kind === "city" ? p.city === name : p.country === name);
  const overall = sliceOf(rows, match);
  const trackedN = rows.filter(match).length;
  const disclosedN = rows.filter((p) => match(p) && p.disclosed).length;

  // Rank vs peer markets (only markets that clear the gate).
  const peers = kind === "city" ? rankCitiesBy(rows, () => true) : rankCountriesBy(rows, () => true);
  const idx = peers.findIndex((p) => p.label === name);
  const rank = idx >= 0 ? { pos: idx + 1, total: peers.length } : null;

  return {
    name, slug: slugify(name), kind,
    overall, trackedN, disclosedN,
    byRole: (() => {
      const m = new Map<string, number[]>();
      for (const r of usable(rows).filter(match)) { const a = m.get(r.roleFamily) || []; a.push(r.annual); m.set(r.roleFamily, a); }
      return [...m.entries()].filter(([, v]) => v.length >= N_MEDIAN)
        .map(([role, v]) => ({ key: role, label: role, slug: slugify(role), value: median(v), n: v.length }))
        .sort((a, b) => b.value - a.value);
    })(),
    topPayers: rankCompaniesBy(rows, match).slice(0, 10),
    rank,
    trend: computeTrend(usable(rows).filter(match).map((p) => ({ dateMs: p.dateMs, value: p.annual })), Date.now()),
  };
}
export const getCityHub = (name: string) => locationHub(name, "city");
export const getCountryHub = (name: string) => locationHub(name, "country");

// Country detail — everything the redesigned country page renders, all live.
// Cities in-country (gated), by-level, role distribution, neighbour comparison
// by median, and computed insight findings (dropped when they don't compute).
export interface CountryDetail {
  name: string; slug: string; code: string | null;
  median: number | null; n: number; trackedN: number; disclosurePct: number;
  rolesBenchmarked: number; medianRank: number | null; total: number;
  companyCount: number;
  companies: RankRow[];
  cities: { city: string; slug: string; median: number; n: number }[];
  byLevel: { level: Level; median: number | null; n: number }[];
  roleDist: { role: string; n: number; pct: number }[];
  compare: { country: string; code: string | null; median: number; isSelf: boolean }[];
  insights: { icon: string; text: string }[];
}
export const getCountryDetail = async (name: string): Promise<CountryDetail> => {
  const rows = await getData();
  const board = await getCountryLeaderboard();
  const inC = (p: Posting) => p.country === name;
  const all = rows.filter(inC);
  const sal = usable(rows).filter(inC);
  const self = board.find((c) => c.country === name);
  const rankIdx = board.findIndex((c) => c.country === name);
  const disclosed = all.filter((p) => p.disclosed).length;

  // Cities in-country (gated).
  const byCity = new Map<string, number[]>();
  for (const r of sal) { if (!r.city) continue; const a = byCity.get(r.city) || []; a.push(r.annual); byCity.set(r.city, a); }
  const cities = [...byCity.entries()].filter(([, v]) => v.length >= N_MEDIAN)
    .map(([city, v]) => ({ city, slug: slugify(city), median: Math.round(median(v)), n: v.length }))
    .sort((a, b) => b.median - a.median).slice(0, 8);

  // By level.
  const byLevel = LEVELS.map((level) => {
    const v = sal.filter((p) => p.level === level).map((p) => p.annual);
    return { level, median: v.length >= N_MEDIAN ? Math.round(median(v)) : null, n: v.length };
  });

  // Role distribution (by tracked count).
  const roleCount = new Map<string, number>();
  for (const r of all) roleCount.set(r.roleFamily, (roleCount.get(r.roleFamily) || 0) + 1);
  const roleDist = [...roleCount.entries()].map(([role, n]) => ({ role, n, pct: all.length ? Math.round((n / all.length) * 100) : 0 }))
    .sort((a, b) => b.n - a.n);

  // Gated role families (roles benchmarked).
  const roleSal = new Map<string, number>();
  for (const r of sal) roleSal.set(r.roleFamily, (roleSal.get(r.roleFamily) || 0) + 1);
  const rolesBenchmarked = [...roleSal.values()].filter((n) => n >= N_MEDIAN).length;

  // Neighbour comparison: window of 5 around this country by median.
  let compare: CountryDetail["compare"] = [];
  if (rankIdx >= 0) {
    const start = Math.max(0, Math.min(rankIdx - 2, board.length - 5));
    compare = board.slice(start, start + 5).map((c) => ({ country: c.country, code: c.code, median: c.median, isSelf: c.country === name }));
  }

  // Computed insights (drop any that don't compute).
  const insights: { icon: string; text: string }[] = [];
  const natMed = self?.median ?? null;
  if (cities.length && natMed) {
    const top = cities[0];
    const d = Math.round(((top.median - natMed) / natMed) * 100);
    if (d > 0) insights.push({ icon: "pin", text: `${top.city} leads ${name} at ${eurFmt(top.median)}, ${d}% above the national median.` });
  }
  if (roleDist.length) {
    const topRole = roleDist.find((r) => r.role !== "Other") ?? roleDist[0];
    insights.push({ icon: "briefcase", text: `Most tracked roles are ${topRole.role} (${topRole.pct}% of postings).` });
  }
  {
    const compCount = new Map<string, number>();
    for (const r of all) compCount.set(r.company, (compCount.get(r.company) || 0) + 1);
    const top = [...compCount.entries()].sort((a, b) => b[1] - a[1])[0];
    if (top && all.length) insights.push({ icon: "building", text: `${top[0]} accounts for ${Math.round((top[1] / all.length) * 100)}% of tracked postings here.` });
  }
  if (self) {
    const tRank = [...board].sort((a, b) => b.disclosurePct - a.disclosurePct).findIndex((c) => c.country === name) + 1;
    insights.push({ icon: "shield", text: `${self.disclosurePct}% of ads disclose pay — #${tRank} of ${board.length} for transparency.` });
  }

  return {
    name, slug: slugify(name), code: iso2(name),
    median: self?.median ?? (sal.length >= N_MEDIAN ? Math.round(median(sal.map((r) => r.annual))) : null),
    n: sal.length, trackedN: all.length,
    disclosurePct: all.length ? Math.round((disclosed / all.length) * 100) : 0,
    rolesBenchmarked, medianRank: rankIdx >= 0 ? rankIdx + 1 : null, total: board.length,
    companyCount: new Set(all.map((p) => p.company)).size,
    companies: rankCompaniesBy(rows, inC).slice(0, 8),
    cities, byLevel, roleDist, compare, insights,
  };
};

// City detail — everything the redesigned city page renders, all live.
export interface CityDetail {
  name: string; slug: string; country: string | null; code: string | null;
  median: number | null; n: number; trackedN: number; disclosurePct: number; rolesBenchmarked: number;
  countryMedian: number | null; rankInCountry: { pos: number; total: number } | null;
  topRoles: { role: string; slug: string; median: number; n: number }[];
  topCompanies: RankRow[];
  history: { month: string; n: number; median: number }[];
  related: { city: string; slug: string; median: number; n: number; code: string | null; country: string | null }[];
}
export const getCityDetail = async (name: string): Promise<CityDetail> => {
  const rows = await getData();
  const inCity = (p: Posting) => p.city === name;
  const all = rows.filter(inCity);
  const sal = usable(rows).filter(inCity);
  // Home country = most common country among this city's postings.
  const cc = new Map<string, number>();
  for (const p of all) if (p.country) cc.set(p.country, (cc.get(p.country) || 0) + 1);
  const country = [...cc.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const disclosed = all.filter((p) => p.disclosed).length;

  // Cities in the same country, by median (gated) — for rank + related tiles.
  const countrySal = country ? usable(rows).filter((p) => p.country === country) : [];
  const byCityInCountry = new Map<string, number[]>();
  for (const p of countrySal) { if (!p.city) continue; const a = byCityInCountry.get(p.city) || []; a.push(p.annual); byCityInCountry.set(p.city, a); }
  const rankedCities = [...byCityInCountry.entries()].filter(([, v]) => v.length >= N_MEDIAN)
    .map(([city, v]) => ({ city, slug: slugify(city), median: Math.round(median(v)), n: v.length, code: iso2(country), country }))
    .sort((a, b) => b.median - a.median);
  const posIdx = rankedCities.findIndex((c) => c.city === name);
  const rankInCountry = posIdx >= 0 ? { pos: posIdx + 1, total: rankedCities.length } : null;
  const countryMedian = countrySal.length >= N_MEDIAN ? Math.round(median(countrySal.map((p) => p.annual))) : null;
  const related = rankedCities.filter((c) => c.city !== name).slice(0, 4);

  // Top roles (gated) in this city.
  const byRole = new Map<string, number[]>();
  for (const p of sal) { const a = byRole.get(p.roleFamily) || []; a.push(p.annual); byRole.set(p.roleFamily, a); }
  const topRoles = [...byRole.entries()].filter(([, v]) => v.length >= N_MEDIAN)
    .map(([role, v]) => ({ role, slug: slugify(role), median: Math.round(median(v)), n: v.length }))
    .sort((a, b) => b.median - a.median).slice(0, 10);
  const rolesBenchmarked = topRoles.length;

  // Monthly history (gated).
  const byMonth = new Map<string, number[]>();
  for (const p of sal) { if (!p.dateMs) continue; const d = new Date(p.dateMs); const k = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`; const a = byMonth.get(k) || []; a.push(p.annual); byMonth.set(k, a); }
  let history = [...byMonth.entries()].filter(([, v]) => v.length >= 3).map(([month, v]) => ({ month, n: v.length, median: Math.round(median(v)) })).sort((a, b) => a.month.localeCompare(b.month));
  if (history.length < 2) history = [];

  return {
    name, slug: slugify(name), country, code: iso2(country),
    median: sal.length >= N_MEDIAN ? Math.round(median(sal.map((p) => p.annual))) : null,
    n: sal.length, trackedN: all.length, disclosurePct: all.length ? Math.round((disclosed / all.length) * 100) : 0,
    rolesBenchmarked, countryMedian, rankInCountry, topRoles,
    topCompanies: rankCompaniesBy(rows, inCity).slice(0, 8), history, related,
  };
};

// ---------------------------------------------------------------------------
// Company detail (upgraded)
// ---------------------------------------------------------------------------
export interface LatestPosting {
  title: string; city: string; lo: number; hi: number; postedAt: string | null; url: string | null;
}
export interface PeerStat { company: string; slug: string; payScore: number; midpoint: number; disclosurePct: number; }
export interface CompanyDetail extends CompanyStat {
  roles: { role: string; slug: string; companyMedian: number | null; companyN: number; sectorMedian: number | null }[];
  similar: { company: string; slug: string; midpoint: number; sector: Sector }[];
  latest: LatestPosting[];
  careersUrl: string | null;
  peers: PeerStat[];                         // 2 nearest sector peers by Pay Score
  sectorPeers: { company: string; slug: string; payScore: number }[]; // whole sector, for the distribution dot
  history: { month: string; n: number; median: number }[];           // monthly buckets, gated
  markets: { country: string; postings: number; median: number | null }[]; // where they hire
  offices: { city: string; lat: number; lon: number; n: number }[];        // office-city dots
}

// Annualize an advertised RANGE as a pair (not per-bound), so a monthly range
// straddling the 25k threshold can't invert into "€204k–€55k". Swaps inverted
// pairs, applies one period decision to both bounds, and rejects ratio > 3.
function annualizeRange(min: number | null, max: number | null, period: string | null): { lo: number; hi: number } | null {
  let lo = min && min > 0 ? min : null;
  let hi = max && max > 0 ? max : null;
  if (lo == null && hi == null) return null;
  if (lo == null) lo = hi;
  if (hi == null) hi = lo;
  if (lo! > hi!) [lo, hi] = [hi, lo]; // swap inverted
  if (lo! < 1000 && hi! >= 10_000) return null; // digit-grouping misparse
  const p = (period || "year").toLowerCase();
  // Period-aware width gate: annual bands up to 4x, monthly/hourly strict 3x.
  if (hi! / lo! > (p === "year" ? 4 : 3)) return null;
  let f = 1;
  if (p === "month") f = hi! > 25_000 ? 1 : 12; // decide once from the top bound
  else if (p === "hour") f = hi! <= 400 ? 1720 : 1;
  return { lo: Math.round(lo! * f), hi: Math.round(hi! * f) };
}

function careersUrl(ats: string, token: string): string {
  switch (ats) {
    case "greenhouse": return `https://boards.greenhouse.io/${token}`;
    case "lever": return `https://jobs.lever.co/${token}`;
    case "ashby": return `https://jobs.ashbyhq.com/${token}`;
    case "smartrecruiters": return `https://jobs.smartrecruiters.com/${token}`;
    case "recruitee": return `https://${token}.recruitee.com`;
    case "teamtailor": return `https://${token}.teamtailor.com/jobs`;
    default: return "";
  }
}

export async function getCompanyBySlug(slug: string): Promise<CompanyDetail | null> {
  const board = await getCompaniesBoard();
  const stat = board.find((c) => c.slug === slug);
  if (!stat) return null;
  const rows = await getData();

  // Sector median per role (peers in same sector).
  const sectorRole = new Map<string, number[]>();
  for (const r of usable(rows).filter((p) => p.sector === stat.sector)) {
    const a = sectorRole.get(r.roleFamily) || []; a.push(r.annual); sectorRole.set(r.roleFamily, a);
  }
  const companyRole = new Map<string, number[]>();
  for (const r of usable(rows).filter((p) => p.company === stat.company)) {
    const a = companyRole.get(r.roleFamily) || []; a.push(r.annual); companyRole.set(r.roleFamily, a);
  }
  const roles = [...companyRole.entries()]
    .map(([role, v]) => {
      const sec = sectorRole.get(role) || [];
      return {
        role, slug: slugify(role),
        companyMedian: v.length >= N_COMPANY ? median(v) : null, companyN: v.length,
        sectorMedian: sec.length >= N_MEDIAN ? median(sec) : null,
      };
    })
    .sort((a, b) => b.companyN - a.companyN);

  // Similar companies = same sector, nearest midpoint.
  const similar = board
    .filter((c) => c.sector === stat.sector && c.company !== stat.company)
    .map((c) => ({ company: c.company, slug: c.slug, midpoint: c.midpoint, sector: c.sector, d: Math.abs(c.midpoint - stat.midpoint) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 4)
    .map(({ d, ...c }) => c);

  // Sector cohort (for the distribution dot) + 2 nearest peers by Pay Score.
  const inSector = board.filter((c) => c.sector === stat.sector);
  const sectorPeers = inSector
    .map((c) => ({ company: c.company, slug: c.slug, payScore: c.payScore }))
    .sort((a, b) => b.payScore - a.payScore);
  const peers: PeerStat[] = inSector
    .filter((c) => c.slug !== stat.slug)
    .map((c) => ({ company: c.company, slug: c.slug, payScore: c.payScore, midpoint: c.midpoint, disclosurePct: c.disclosurePct, d: Math.abs(c.payScore - stat.payScore) }))
    .sort((a, b) => a.d - b.d || b.midpoint - a.midpoint)
    .slice(0, 2)
    .map(({ d, ...p }) => p);

  // Salary history: monthly buckets from posted_at. Only surfaced once there
  // are >=2 months each with a real sample (>=3), else gated to "not enough".
  const byMonth = new Map<string, number[]>();
  for (const p of usable(rows).filter((p) => p.company === stat.company && p.dateMs > 0)) {
    const d = new Date(p.dateMs);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const a = byMonth.get(key) || []; a.push(p.annual); byMonth.set(key, a);
  }
  let history = [...byMonth.entries()]
    .filter(([, v]) => v.length >= 3)
    .map(([month, v]) => ({ month, n: v.length, median: Math.round(median(v)) }))
    .sort((a, b) => a.month.localeCompare(b.month));
  if (history.length < 2) history = [];

  // Where they hire: active postings per country (median where salaried n>=3),
  // and office-city dots for the map.
  const compAll = rows.filter((p) => p.company === stat.company);
  const mByCountry = new Map<string, { all: number; sal: number[] }>();
  for (const p of compAll) {
    if (!p.country) continue;
    const g = mByCountry.get(p.country) || { all: 0, sal: [] };
    g.all++; if (p.annual != null) g.sal.push(p.annual);
    mByCountry.set(p.country, g);
  }
  const markets = [...mByCountry.entries()]
    .map(([country, g]) => ({ country, postings: g.all, median: g.sal.length >= N_COMPANY ? Math.round(median(g.sal)) : null }))
    .sort((a, b) => b.postings - a.postings);
  const { CITY_COORDS } = await import("./cityCoords");
  const cityCount = new Map<string, number>();
  for (const p of compAll) if (p.city) cityCount.set(p.city, (cityCount.get(p.city) || 0) + 1);
  const offices = [...cityCount.entries()]
    .filter(([c]) => CITY_COORDS[c])
    .map(([city, n]) => ({ city, lat: CITY_COORDS[city][0], lon: CITY_COORDS[city][1], n }))
    .sort((a, b) => b.n - a.n).slice(0, 12);

  // Careers link + latest salaried postings from Supabase.
  let careers: string | null = null;
  const latest: LatestPosting[] = [];
  const sb = getSupabase();
  if (sb) {
    const [meta, posts] = await Promise.all([
      sb.from("companies").select("ats,token").eq("name", stat.company).limit(1),
      sb.from("job_postings")
        .select("title,city,location,salary_eur_min,salary_eur_max,salary_period,posted_at,url,multi_market,currency,region,salary_source")
        .eq("company", stat.company).eq("status", "active").neq("salary_source", "none")
        .order("posted_at", { ascending: false }).limit(30),
    ]);
    const m = meta.data?.[0] as any;
    if (m?.ats && m?.token) careers = careersUrl(m.ats, m.token) || null;

    for (const r of (posts.data as any[]) || []) {
      if (r.region === "NONEMEA") continue;
      if (r.salary_source === "parsed_suspect") continue; // untrusted parse
      if (!EMEA_CURRENCIES.has((r.currency || "EUR").toUpperCase())) continue; // no USD-band leakage
      const rng = annualizeRange(r.salary_eur_min, r.salary_eur_max, r.salary_period);
      if (!rng || rng.lo < 20_000 || rng.lo > 500_000) continue; // plausibility + suspect gate
      const place = resolvePlace(r.city || r.location, null);
      latest.push({
        title: r.title || "Role", city: place.city || place.country || "—",
        lo: rng.lo, hi: rng.hi, postedAt: r.posted_at || null, url: r.url || null,
      });
      if (latest.length >= 6) break;
    }
  }

  return { ...stat, roles, similar, latest, careersUrl: careers, peers, sectorPeers, history, markets, offices };
}

export async function getAllCompanySlugs(): Promise<string[]> {
  return (await getCompaniesBoard()).map((c) => c.slug);
}

// ---------------------------------------------------------------------------
// Compare — side-by-side company stats + median by role.
// ---------------------------------------------------------------------------
export interface CompareCompany {
  company: string; slug: string; sector: Sector; payScore: number;
  disclosurePct: number; midpoint: number; sectorRank: number; sectorTotal: number;
  roleMedians: Record<string, number>;
}
export async function getCompare(slugs: string[]): Promise<CompareCompany[]> {
  const board = await getCompaniesBoard();
  const rows = usable(await getData());
  const out: CompareCompany[] = [];
  for (const slug of slugs.slice(0, 3)) {
    const stat = board.find((c) => c.slug === slug);
    if (!stat || out.some((o) => o.slug === slug)) continue;
    const byRole = new Map<string, number[]>();
    for (const r of rows) {
      if (r.company !== stat.company) continue;
      const a = byRole.get(r.roleFamily) || []; a.push(r.annual); byRole.set(r.roleFamily, a);
    }
    const roleMedians: Record<string, number> = {};
    for (const [role, v] of byRole.entries()) if (v.length >= N_COMPANY) roleMedians[role] = Math.round(median(v));
    out.push({
      company: stat.company, slug: stat.slug, sector: stat.sector, payScore: stat.payScore,
      disclosurePct: stat.disclosurePct, midpoint: stat.midpoint,
      sectorRank: stat.sectorRank, sectorTotal: stat.sectorTotal, roleMedians,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// City map data — salaried count + median per city (for the EMEA bubble map).
// ---------------------------------------------------------------------------
export interface MapCity { city: string; slug: string; n: number; median: number; lat: number; lon: number; concentration: Concentration | null; country: string | null; }
export const getCityMapData = async (): Promise<{ cities: MapCity[]; emeaMedian: number }> => {
  const { CITY_COORDS } = await import("./cityCoords");
  const rows = usable(await getData());
  const byCity = new Map<string, (Posting & { annual: number })[]>();
  for (const r of rows) {
    if (!r.city) continue;
    const a = byCity.get(r.city) || []; a.push(r); byCity.set(r.city, a);
  }
  const emeaMedian = rows.length ? median(rows.map((r) => r.annual)) : 0;
  const cities: MapCity[] = [];
  for (const [city, rs] of byCity.entries()) {
    const coords = CITY_COORDS[city];
    if (!coords || rs.length < 5) continue; // need coords + a real sample
    const cc = new Map<string, number>();
    for (const r of rs) if (r.country) cc.set(r.country, (cc.get(r.country) || 0) + 1);
    const country = [...cc.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    cities.push({
      city, slug: slugify(city), n: rs.length, median: Math.round(median(rs.map((r) => r.annual))),
      lat: coords[0], lon: coords[1], concentration: topCompanyShare(rs), country,
    });
  }
  cities.sort((a, b) => b.n - a.n);
  return { cities, emeaMedian: Math.round(emeaMedian) };
};

// ---------------------------------------------------------------------------
// Home hero composition — live figures for the four right-column cards. Pure
// derivation over the already-cached getData() rows (no new query / Supabase
// call): EMEA median + a monthly spark + trend, the top-paying city, and the
// most in-demand role with a posting-volume delta. Any card whose gate isn't
// met comes back null so the UI can drop it rather than invent a number.
// ---------------------------------------------------------------------------
export interface HomeComposition {
  emeaMedian: number;
  salaried: number; // usable salaried postings behind the EMEA median
  spark: number[]; // chronological monthly medians (n>=8 each), for the sparkline
  topCity: { city: string; slug: string; median: number; n: number } | null;
  inDemandRole: { name: string; slug: string; activeN: number } | null;
}
export const getHomeComposition = async (): Promise<HomeComposition> => {
  const all = await getData();
  const u = usable(all);
  const emeaMedian = u.length ? Math.round(median(u.map((r) => r.annual))) : 0;

  // Monthly medians for the sparkline. active-posting posted_at skews hard to
  // the current month (older ads get filled), so only months that clear the
  // n>=8 median gate are trustworthy — thin months would make the line noise.
  const byMonth = new Map<string, number[]>();
  for (const r of u) {
    if (!r.dateMs) continue;
    const d = new Date(r.dateMs);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const a = byMonth.get(key) || []; a.push(r.annual); byMonth.set(key, a);
  }
  const spark = [...byMonth.entries()]
    .filter(([, v]) => v.length >= N_MEDIAN)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-8)
    .map(([, v]) => Math.round(median(v)));

  // Top-paying city — gated at N_MEDIAN and, like the rest of the site, skips
  // single-employer-concentrated markets (e.g. Cardiff = mostly Monzo) so the
  // headline isn't one company's band masquerading as a city rate.
  const byCity = new Map<string, (Posting & { annual: number })[]>();
  for (const r of u) { if (!r.city) continue; const a = byCity.get(r.city) || []; a.push(r); byCity.set(r.city, a); }
  let topCity: HomeComposition["topCity"] = null;
  for (const [city, rs] of byCity) {
    if (rs.length < N_MEDIAN) continue;
    const conc = topCompanyShare(rs);
    if (conc && conc.share > 0.6) continue;
    const med = Math.round(median(rs.map((r) => r.annual)));
    if (!topCity || med > topCity.median) topCity = { city, slug: slugify(city), median: med, n: rs.length };
  }

  // Most in-demand role by active posting volume. We deliberately show the live
  // open-role count rather than a quarter-over-quarter delta: posted_at is too
  // sparse in the prior window to make a QoQ % trustworthy.
  const roleActive = new Map<string, Posting[]>();
  for (const r of all) {
    if (!r.roleFamily || r.roleFamily === "Other") continue;
    const a = roleActive.get(r.roleFamily) || []; a.push(r); roleActive.set(r.roleFamily, a);
  }
  let inDemandRole: HomeComposition["inDemandRole"] = null;
  for (const [name, rs] of roleActive) {
    if (!inDemandRole || rs.length > inDemandRole.activeN) {
      inDemandRole = { name, slug: slugify(name), activeN: rs.length };
    }
  }

  return { emeaMedian, salaried: u.length, spark, topCity, inDemandRole };
};

// Hero country stat band — median base for a fixed reference slice (Software
// Engineer, Mid level) per country, gated at N_MEDIAN, top few by median. Live
// data only; no delta unless we can compute one from stored history (we can't
// reliably at this slice granularity, so it's omitted rather than invented).
export interface HeroBandCell { country: string; code: string | null; median: number; n: number }
export interface HeroBand { role: string; level: string; cells: HeroBandCell[] }
// level omitted => all levels (needed to clear the n>=8 gate for enough countries
// to fill the band; a single narrow level rarely has 5 gated markets).
export const getHeroBand = async (role = "Software Engineer", level?: Level, top = 5): Promise<HeroBand> => {
  const rows = usable(await getData()).filter((p) => p.roleFamily === role && (!level || p.level === level) && p.country);
  const byCountry = new Map<string, number[]>();
  for (const r of rows) { const a = byCountry.get(r.country!) || []; a.push(r.annual); byCountry.set(r.country!, a); }
  const cells: HeroBandCell[] = [...byCountry.entries()]
    .filter(([, v]) => v.length >= N_MEDIAN)
    .map(([country, v]) => ({ country, code: iso2(country), median: Math.round(median(v)), n: v.length }))
    .sort((a, b) => b.median - a.median)
    .slice(0, top);
  return { role, level: level ?? "All levels", cells };
};

// Map insight finding — the top-paying country for a role vs the EMEA median,
// computed from the pay data (no hand-written copy). The flagship #1 slot needs
// n>=N_FLAGSHIP (deeper than the standard median gate) so a thin sample can't
// headline as the top payer; below that we feature the highest-median country
// that does clear it. Also skips concentration-gated single-employer markets.
export interface CountryFinding { country: string; slug: string; median: number; deltaPct: number; n: number }
export function topCountryFinding(rp: RolePay): CountryFinding | null {
  const eligible = rp.countries
    .filter((c) => c.median != null && c.n >= N_FLAGSHIP && !(c.concentration && c.concentration.share > 0.6))
    .sort((a, b) => b.median! - a.median!);
  const top = eligible[0];
  if (!top || !rp.emeaMedian) return null;
  return {
    country: top.country, slug: slugify(top.country), median: top.median!,
    deltaPct: Math.round(((top.median! - rp.emeaMedian) / rp.emeaMedian) * 100), n: top.n,
  };
}

// ---------------------------------------------------------------------------
// Sectors present (for the board chips)
// ---------------------------------------------------------------------------
export const getSectors = async (): Promise<Sector[]> => {
  const board = await getCompaniesBoard();
  return [...new Set(board.map((c) => c.sector))].sort() as Sector[];
};

// ---------------------------------------------------------------------------
// Home search (kept from v1, adapted to the new model)
// ---------------------------------------------------------------------------
const fetchApprovedSubmissions = unstable_cache(
  async () => {
    const sb = getSupabase();
    if (!sb) return [] as any[];
    const { data } = await sb
      .from("submissions")
      .select("role_family,level,company,city,base_eur")
      .eq("status", "approved");
    return data || [];
  },
  ["trueline-approved"],
  { revalidate: 3600 }
);

export const getFilterOptions = async () => {
  const [roles, cities] = await Promise.all([getRoleFamilies(), getCityList()]);
  return { roles, cities: cities.map((c) => ({ key: c.city, label: c.city, n: c.n })) };
};

export interface SearchResult {
  enough: boolean; n: number; role: string; level: string; city: string;
  spread: Spread | null; advertisedN: number; verifiedN: number;
  verifiedMedian: number | null; // median of approved submissions, only when n >= 3
  base: number | null; basePercentile: number | null; baseDelta: number | null;
  topPayers: { company: string; slug: string; midpoint: number; n: number }[];
  acrossCities: { city: string; cityKey: string; median: number; n: number }[];
}

const N_VERIFIED = 3;

export async function searchSalaries(p: {
  role?: string; level?: string; city?: string; base?: number;
}): Promise<SearchResult> {
  const rows = await getData();
  const role = p.role && p.role !== "Any" ? p.role : "Any";
  const level = p.level && p.level !== "Any" ? p.level : "Any";
  const city = p.city && p.city !== "Any" ? p.city : "Any";
  const cityL = city.toLowerCase();

  const roleLevel = (r: Posting) =>
    (role === "Any" || r.roleFamily === role) && (level === "Any" || r.level === level);
  const mainPred = (r: Posting) => roleLevel(r) && (city === "Any" || (r.city || "").toLowerCase() === cityL);

  const values = usable(rows).filter(mainPred).map((r) => r.annual);
  const sp = spread(values);
  const base = p.base && p.base > 0 ? p.base : null;

  const subs = await fetchApprovedSubmissions();
  const matchingSubs = subs.filter(
    (s: any) => (role === "Any" || s.role_family === role) &&
      (level === "Any" || s.level === level) &&
      (city === "Any" || (s.city || "").toLowerCase() === cityL)
  );
  const verifiedN = matchingSubs.length;
  const verifiedVals = matchingSubs
    .map((s: any) => Number(s.base_eur))
    .filter((v: number) => Number.isFinite(v) && v > 0);
  // Verified salaries only surface at 3+ per slice (same honesty as advertised gates).
  const verifiedMedian = verifiedVals.length >= N_VERIFIED ? Math.round(median(verifiedVals)) : null;

  const cityLabel = city === "Any" ? "Europe" : usable(rows).find(mainPred)?.city || city;

  if (!sp || sp.n < N_MEDIAN) {
    return {
      enough: false, n: sp?.n ?? 0, role, level, city: cityLabel, spread: null,
      advertisedN: sp?.n ?? 0, verifiedN, verifiedMedian, base, basePercentile: null, baseDelta: null,
      topPayers: [], acrossCities: [],
    };
  }
  const topPayers = rankCompaniesBy(rows, roleLevel).slice(0, 6)
    .map((r) => ({ company: r.label, slug: r.slug, midpoint: r.value, n: r.n }));
  const acrossCities = rankCitiesBy(rows, roleLevel).slice(0, 8)
    .map((r) => ({ city: r.label, cityKey: r.label, median: r.value, n: r.n }));

  return {
    enough: true, n: sp.n, role, level, city: cityLabel, spread: sp,
    advertisedN: sp.n, verifiedN, verifiedMedian, base,
    basePercentile: base ? percentileRank(values, base) : null,
    baseDelta: base ? Math.round(base - sp.median) : null,
    topPayers, acrossCities,
  };
}
