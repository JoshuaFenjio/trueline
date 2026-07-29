import "server-only";
import { cache } from "react";
import { getSupabase, isConfigured } from "./supabase";
import { annualMidpointEur, spread, percentileRank, median, Spread } from "./stats";
import { levelBucket, Level } from "./levels";
import { sectorOf } from "./sectors";
import { slugify } from "./format";

export { isConfigured };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface EnrichedPosting {
  company: string;
  roleFamily: string;
  level: Level;
  title: string;
  city: string;
  cityKey: string;
  country: string | null;
  remote: boolean;
  annual: number;
  source: string; // structured | parsed
  url: string | null;
}

function deriveCity(city: string | null, location: string | null): string {
  const c = (city || "").trim();
  if (c) return c;
  const loc = (location || "").trim();
  if (!loc) return "Remote";
  const first = loc.split(/[,/;|]/)[0].trim();
  return first || "Remote";
}

// ---------------------------------------------------------------------------
// Base fetch — all active, salaried postings, enriched. Cached per request.
// ---------------------------------------------------------------------------
export const fetchSalaried = cache(async (): Promise<EnrichedPosting[]> => {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("job_postings")
    .select(
      "company,role_family,title,city,location,country,remote,salary_eur_min,salary_eur_max,salary_period,salary_source"
    )
    .eq("status", "active")
    .neq("salary_source", "none")
    .range(0, 4999);
  if (error || !data) return [];

  const out: EnrichedPosting[] = [];
  for (const r of data as any[]) {
    const annual = annualMidpointEur(r);
    if (annual === null) continue;
    const city = deriveCity(r.city, r.location);
    out.push({
      company: r.company,
      roleFamily: r.role_family || "Other",
      level: levelBucket(r.title),
      title: r.title || "",
      city,
      cityKey: city.toLowerCase(),
      country: r.country,
      remote: !!r.remote,
      annual,
      source: r.salary_source,
      url: r.url || null,
    });
  }
  return out;
});

export const fetchApprovedSubmissions = cache(async () => {
  const sb = getSupabase();
  if (!sb) return [] as any[];
  const { data, error } = await sb
    .from("submissions")
    .select("role_family,level,company,city,country,base_eur")
    .eq("status", "approved");
  if (error || !data) return [];
  return data as any[];
});

// ---------------------------------------------------------------------------
// Live stats for the hero pill
// ---------------------------------------------------------------------------
export const getLiveStats = cache(async () => {
  const sb = getSupabase();
  if (!sb) return { companies: 0, postings: 0, salaried: 0, cities: 0 };

  const [companies, postings, salaried] = await Promise.all([
    sb.from("companies").select("*", { count: "exact", head: true }),
    sb.from("job_postings").select("*", { count: "exact", head: true }).eq("status", "active"),
    sb
      .from("job_postings")
      .select("*", { count: "exact", head: true })
      .eq("status", "active")
      .neq("salary_source", "none"),
  ]);

  const rows = await fetchSalaried();
  const cities = new Set(rows.map((r) => r.cityKey)).size;

  return {
    companies: companies.count ?? 0,
    postings: postings.count ?? 0,
    salaried: salaried.count ?? 0,
    cities,
  };
});

// ---------------------------------------------------------------------------
// Filter options for the search form
// ---------------------------------------------------------------------------
export const getFilterOptions = cache(async () => {
  const rows = await fetchSalaried();
  const roleCounts = new Map<string, number>();
  const cityCounts = new Map<string, { label: string; n: number }>();
  for (const r of rows) {
    roleCounts.set(r.roleFamily, (roleCounts.get(r.roleFamily) || 0) + 1);
    const c = cityCounts.get(r.cityKey) || { label: r.city, n: 0 };
    c.n += 1;
    cityCounts.set(r.cityKey, c);
  }
  const roles = [...roleCounts.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  const cities = [...cityCounts.entries()]
    .sort((a, b) => b[1].n - a[1].n)
    .map(([key, v]) => ({ key, label: v.label, n: v.n }));
  return { roles, cities };
});

// ---------------------------------------------------------------------------
// THE SEARCH
// ---------------------------------------------------------------------------
export interface SearchParams {
  role?: string;
  level?: string;
  city?: string;
  base?: number;
}

export interface CompanyMid {
  company: string;
  slug: string;
  midpoint: number;
  n: number;
}
export interface CityMid {
  city: string;
  cityKey: string;
  median: number;
  n: number;
}

export interface SearchResult {
  enough: boolean;
  n: number;
  role: string;
  level: string;
  city: string;
  spread: Spread | null;
  advertisedN: number;
  verifiedN: number;
  base: number | null;
  basePercentile: number | null;
  baseDelta: number | null; // base - median (negative = below)
  topPayers: CompanyMid[];
  acrossCities: CityMid[];
}

const MIN_N = 8;

export async function searchSalaries(p: SearchParams): Promise<SearchResult> {
  const rows = await fetchSalaried();
  const role = p.role && p.role !== "Any" ? p.role : "Any";
  const level = p.level && p.level !== "Any" ? p.level : "Any";
  const city = p.city && p.city !== "Any" ? p.city : "Any";

  const matchRoleLevel = rows.filter(
    (r) => (role === "Any" || r.roleFamily === role) && (level === "Any" || r.level === level)
  );
  const mainSet =
    city === "Any" ? matchRoleLevel : matchRoleLevel.filter((r) => r.cityKey === city);

  const values = mainSet.map((r) => r.annual);
  const sp = spread(values);
  const base = p.base && p.base > 0 ? p.base : null;

  // Verified (approved submissions) matching the same role/level/city.
  const subs = await fetchApprovedSubmissions();
  const verifiedN = subs.filter(
    (s) =>
      (role === "Any" || s.role_family === role) &&
      (level === "Any" || s.level === level) &&
      (city === "Any" || (s.city || "").toLowerCase() === city)
  ).length;

  const cityLabel =
    city === "Any"
      ? "Europe"
      : mainSet[0]?.city || city.charAt(0).toUpperCase() + city.slice(1);

  if (!sp || sp.n < MIN_N) {
    return {
      enough: false, n: sp?.n ?? 0, role, level, city: cityLabel, spread: sp,
      advertisedN: sp?.n ?? 0, verifiedN, base, basePercentile: null, baseDelta: null,
      topPayers: [], acrossCities: [],
    };
  }

  // Top payers — per-company midpoints across role+level (city-independent), min 3.
  const byCompany = new Map<string, number[]>();
  for (const r of matchRoleLevel) {
    const arr = byCompany.get(r.company) || [];
    arr.push(r.annual);
    byCompany.set(r.company, arr);
  }
  const topPayers: CompanyMid[] = [...byCompany.entries()]
    .filter(([, v]) => v.length >= 3)
    .map(([company, v]) => ({
      company, slug: slugify(company), midpoint: median(v), n: v.length,
    }))
    .sort((a, b) => b.midpoint - a.midpoint)
    .slice(0, 6);

  // Same role across cities (ignore the city filter), min 5 each.
  const byCity = new Map<string, { label: string; vals: number[] }>();
  for (const r of matchRoleLevel) {
    const c = byCity.get(r.cityKey) || { label: r.city, vals: [] };
    c.vals.push(r.annual);
    byCity.set(r.cityKey, c);
  }
  const acrossCities: CityMid[] = [...byCity.entries()]
    .filter(([, v]) => v.vals.length >= 5)
    .map(([cityKey, v]) => ({
      city: v.label, cityKey, median: median(v.vals), n: v.vals.length,
    }))
    .sort((a, b) => b.median - a.median)
    .slice(0, 8);

  const basePercentile = base ? percentileRank(values, base) : null;
  const baseDelta = base ? Math.round(base - sp.median) : null;

  return {
    enough: true, n: sp.n, role, level, city: cityLabel, spread: sp,
    advertisedN: sp.n, verifiedN, base, basePercentile, baseDelta,
    topPayers, acrossCities,
  };
}

// ---------------------------------------------------------------------------
// COMPANIES BOARD
// ---------------------------------------------------------------------------
export interface BoardCompany {
  company: string;
  slug: string;
  sector: string;
  medianBase: number;
  n: number;
  payScore: number;
}

const BOARD_MIN_N = 3;

export const getCompaniesBoard = cache(async (): Promise<BoardCompany[]> => {
  const rows = await fetchSalaried();
  const byCompany = new Map<string, number[]>();
  for (const r of rows) {
    const arr = byCompany.get(r.company) || [];
    arr.push(r.annual);
    byCompany.set(r.company, arr);
  }

  const base = [...byCompany.entries()]
    .filter(([, v]) => v.length >= BOARD_MIN_N)
    .map(([company, v]) => ({
      company, slug: slugify(company), sector: sectorOf(company),
      medianBase: median(v), n: v.length,
    }));

  // Pay Score = percentile of company's median vs its sector peers.
  const sectorMedians = new Map<string, number[]>();
  for (const c of base) {
    const arr = sectorMedians.get(c.sector) || [];
    arr.push(c.medianBase);
    sectorMedians.set(c.sector, arr);
  }
  return base
    .map((c) => ({
      ...c,
      payScore: percentileRank(sectorMedians.get(c.sector) || [], c.medianBase),
    }))
    .sort((a, b) => b.payScore - a.payScore);
});

export async function getSectors(): Promise<string[]> {
  const board = await getCompaniesBoard();
  return [...new Set(board.map((c) => c.sector))].sort();
}

// ---------------------------------------------------------------------------
// COMPANY PAGE
// ---------------------------------------------------------------------------
export interface RoleRow {
  role: string;
  companyMedian: number | null;
  companyN: number;
  marketMedian: number | null;
  marketN: number;
}
export interface CompanyDetail {
  company: string;
  slug: string;
  sector: string;
  payScore: number;
  medianBase: number;
  salariedN: number;
  activeN: number;
  disclosurePct: number;
  roles: RoleRow[];
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
  const match = board.find((c) => c.slug === slug);
  if (!match) return null;

  const rows = await fetchSalaried();
  const companyRows = rows.filter((r) => r.company === match.company);

  // Market medians per role across ALL companies.
  const marketByRole = new Map<string, number[]>();
  for (const r of rows) {
    const arr = marketByRole.get(r.roleFamily) || [];
    arr.push(r.annual);
    marketByRole.set(r.roleFamily, arr);
  }
  const companyByRole = new Map<string, number[]>();
  for (const r of companyRows) {
    const arr = companyByRole.get(r.roleFamily) || [];
    arr.push(r.annual);
    companyByRole.set(r.roleFamily, arr);
  }

  const roles: RoleRow[] = [...companyByRole.entries()]
    .map(([role, v]) => {
      const mk = marketByRole.get(role) || [];
      return {
        role,
        companyN: v.length,
        companyMedian: v.length >= 3 ? median(v) : null,
        marketN: mk.length,
        marketMedian: mk.length >= 8 ? median(mk) : null,
      };
    })
    .sort((a, b) => b.companyN - a.companyN);

  // Disclosure % and careers link via the companies table.
  const sb = getSupabase();
  let activeN = match.n;
  let careers: string | null = null;
  if (sb) {
    const [{ count }, meta] = await Promise.all([
      sb.from("job_postings").select("*", { count: "exact", head: true })
        .eq("company", match.company).eq("status", "active"),
      sb.from("companies").select("ats,token").eq("name", match.company).limit(1),
    ]);
    activeN = count ?? match.n;
    const m = meta.data?.[0] as any;
    if (m?.ats && m?.token) careers = careersUrl(m.ats, m.token) || null;
  }

  const salariedN = companyRows.length;
  return {
    company: match.company,
    slug: match.slug,
    sector: match.sector,
    payScore: match.payScore,
    medianBase: match.medianBase,
    salariedN,
    activeN,
    disclosurePct: activeN > 0 ? Math.round((salariedN / activeN) * 100) : 0,
    roles,
    careersUrl: careers,
  };
}

export async function getAllCompanySlugs(): Promise<string[]> {
  const board = await getCompaniesBoard();
  return board.map((c) => c.slug);
}
