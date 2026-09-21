import "server-only";
import type { Posting } from "./data";
import { slugify } from "./format";

// One shared view-model for every "live postings" list on the site (role pages,
// company pages, role-request confirmations, the filterable full lists). Built
// from the already-cached getData() rows — no extra Supabase round-trip and the
// same trust gates as the medians, so a row can never show a figure the rest of
// the site would refuse to count.
export interface PostingVM {
  title: string;
  company: string;
  companySlug: string;
  city: string | null;
  country: string | null;
  remote: boolean;
  /** Advertised EUR band, display only. Null when the ad disclosed nothing we trust. */
  lo: number | null;
  hi: number | null;
  /** EUR midpoint — shown when the band itself didn't annualize sanely. */
  midpoint: number | null;
  level: string;
  levelExplicit: boolean;
  roleFamily: string;
  dateMs: number;
  url: string | null;
}

export function toVM(p: Posting): PostingVM {
  return {
    title: p.title || p.roleFamily,
    company: p.company,
    companySlug: slugify(p.company),
    city: p.city,
    country: p.country,
    remote: p.remote,
    lo: p.band?.lo ?? null,
    hi: p.band?.hi ?? null,
    midpoint: p.annual,
    level: p.level,
    levelExplicit: p.levelExplicit,
    roleFamily: p.roleFamily,
    dateMs: p.dateMs,
    url: p.url,
  };
}

export type PostingSort = "new" | "pay";

/** Newest first (undated rows last), or highest advertised pay first (undisclosed last). */
export function sortPostings(rows: PostingVM[], sort: PostingSort): PostingVM[] {
  const out = [...rows];
  if (sort === "pay") {
    out.sort((a, b) => (b.midpoint ?? -1) - (a.midpoint ?? -1) || b.dateMs - a.dateMs);
  } else {
    out.sort((a, b) => b.dateMs - a.dateMs || (b.midpoint ?? -1) - (a.midpoint ?? -1));
  }
  return out;
}

/** De-duplicate by URL (the same ad can appear under several board mirrors). */
export function dedupe(rows: PostingVM[]): PostingVM[] {
  const seen = new Set<string>();
  const out: PostingVM[] = [];
  for (const r of rows) {
    const k = r.url || `${r.company}|${r.title}|${r.city ?? ""}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

/** Latest live postings for a predicate, newest first, capped. */
export function latestFor(rows: Posting[], pred: (p: Posting) => boolean, limit = 12): PostingVM[] {
  return dedupe(sortPostings(rows.filter(pred).map(toVM), "new")).slice(0, limit);
}
