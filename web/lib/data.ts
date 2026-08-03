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

// Currencies whose salary we trust as EMEA base pay on a multi-market posting.
const EMEA_CURRENCIES = new Set(["EUR", "GBP", "CHF", "SEK", "DKK", "NOK", "PLN"]);

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

        const disclosed = r.salary_source && r.salary_source !== "none";
        let annual = disclosed ? annualMidpointEur(r) : null;
        // On a multi-market posting, only trust the salary if it's in an EMEA
        // currency; otherwise it reflects the non-EMEA office (e.g. USD/California).
        if (annual !== null && multiMarket && !EMEA_CURRENCIES.has((r.currency || "").toUpperCase()))
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
  ["trueline-active-v7"],
  { revalidate: 3600 }
);

export async function getData(): Promise<Posting[]> {
  return _fetch();
}

const usable = (rows: Posting[]) => rows.filter((r) => r.annual !== null) as (Posting & { annual: number })[];

// Gates
const N_MEDIAN = 8;
const N_COMPANY = 3;

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
export interface CompanyDetail extends CompanyStat {
  roles: { role: string; slug: string; companyMedian: number | null; companyN: number; sectorMedian: number | null }[];
  similar: { company: string; slug: string; midpoint: number; sector: Sector }[];
  careersUrl: string | null;
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

  // Careers link from companies table.
  let careers: string | null = null;
  const sb = getSupabase();
  if (sb) {
    const { data } = await sb.from("companies").select("ats,token").eq("name", stat.company).limit(1);
    const m = data?.[0] as any;
    if (m?.ats && m?.token) careers = careersUrl(m.ats, m.token) || null;
  }

  return { ...stat, roles, similar, careersUrl: careers };
}

export async function getAllCompanySlugs(): Promise<string[]> {
  return (await getCompaniesBoard()).map((c) => c.slug);
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
