import "server-only";
import { unstable_cache } from "next/cache";
import { getSupabase, isConfigured } from "./supabase";
import {
  annualMidpointEur, spread, percentileRank, median, Spread, computeTrend, Trend,
} from "./stats";
import { levelBucket, isTrainee, Level, LEVELS } from "./levels";
import { sectorOf, Sector } from "./sectors";
import { resolvePlace } from "./geo";
import { slugify } from "./format";

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
  ["trueline-active-v10"],
  { revalidate: 3600 }
);

export async function getData(): Promise<Posting[]> {
  return _fetch();
}

const usable = (rows: Posting[]) => rows.filter((r) => r.annual !== null) as (Posting & { annual: number })[];

// Gates
const N_MEDIAN = 8;
const N_COMPANY = 3;

// A market where one employer supplies most postings is real data but a
// misleading "market" rate. Flag > 60% single-company concentration.
export const CONCENTRATION_GATE = 0.6;
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
    postings: rows.length,
    salaried: u.length,
    cities: new Set(u.map((r) => r.city).filter(Boolean)).size,
  };
};

// ---------------------------------------------------------------------------
// Company stats + board
// ---------------------------------------------------------------------------
export interface CompanyStat {
  company: string; slug: string; sector: Sector;
  midpoint: number; n: number; activeN: number; disclosurePct: number;
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
        midpoint: median(v), n: v.length, activeN: active.length,
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

// ---------------------------------------------------------------------------
// Role hub
// ---------------------------------------------------------------------------
export interface RoleHub {
  role: string; slug: string;
  overall: Slice; trackedN: number;
  byLevel: { level: Level; slice: Slice }[];
  topCities: RankRow[]; topCountries: RankRow[]; topCompanies: RankRow[];
  trend: Trend;
}
export async function getRoleHub(role: string): Promise<RoleHub> {
  const rows = await getData();
  const inRole = (p: Posting) => p.roleFamily === role;
  return {
    role, slug: slugify(role),
    overall: sliceOf(rows, inRole),
    trackedN: rows.filter(inRole).length,
    byLevel: LEVELS.map((level) => ({ level, slice: sliceOf(rows, (p) => inRole(p) && p.level === level) })),
    topCities: rankCitiesBy(rows, inRole).slice(0, 10),
    topCountries: rankCountriesBy(rows, inRole).slice(0, 10),
    topCompanies: rankCompaniesBy(rows, inRole).slice(0, 10),
    trend: computeTrend(usable(rows).filter(inRole).map((p) => ({ dateMs: p.dateMs, value: p.annual })), Date.now()),
  };
}

// ---------------------------------------------------------------------------
// Location hubs (city + country)
// ---------------------------------------------------------------------------
export interface LocationHub {
  name: string; slug: string; kind: "city" | "country";
  overall: Slice; trackedN: number;
  byRole: RankRow[]; topPayers: RankRow[];
  rank: { pos: number; total: number } | null;
  trend: Trend;
}

async function locationHub(name: string, kind: "city" | "country"): Promise<LocationHub> {
  const rows = await getData();
  const match = (p: Posting) => (kind === "city" ? p.city === name : p.country === name);
  const overall = sliceOf(rows, match);
  const trackedN = rows.filter(match).length;

  // Rank vs peer markets (only markets that clear the gate).
  const peers = kind === "city" ? rankCitiesBy(rows, () => true) : rankCountriesBy(rows, () => true);
  const idx = peers.findIndex((p) => p.label === name);
  const rank = idx >= 0 ? { pos: idx + 1, total: peers.length } : null;

  return {
    name, slug: slugify(name), kind,
    overall, trackedN,
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

// ---------------------------------------------------------------------------
// Company detail (upgraded)
// ---------------------------------------------------------------------------
export interface LatestPosting {
  title: string; city: string; lo: number; hi: number; postedAt: string | null; url: string | null;
}
export interface CompanyDetail extends CompanyStat {
  roles: { role: string; slug: string; companyMedian: number | null; companyN: number; sectorMedian: number | null }[];
  similar: { company: string; slug: string; midpoint: number; sector: Sector }[];
  latest: LatestPosting[];
  careersUrl: string | null;
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
  const p = (period || "year").toLowerCase();
  let f = 1;
  if (p === "month") f = hi! > 25_000 ? 1 : 12; // decide once from the top bound
  else if (p === "hour") f = hi! <= 400 ? 1720 : 1;
  const L = Math.round(lo! * f), H = Math.round(hi! * f);
  if (H / L > 3) return null; // suspect (OTE-as-base / mixed units / misparse)
  return { lo: L, hi: H };
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

  return { ...stat, roles, similar, latest, careersUrl: careers };
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
export interface MapCity { city: string; slug: string; n: number; median: number; lat: number; lon: number; concentration: Concentration | null; }
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
    cities.push({
      city, slug: slugify(city), n: rs.length, median: Math.round(median(rs.map((r) => r.annual))),
      lat: coords[0], lon: coords[1], concentration: topCompanyShare(rs),
    });
  }
  cities.sort((a, b) => b.n - a.n);
  return { cities, emeaMedian: Math.round(emeaMedian) };
};

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
