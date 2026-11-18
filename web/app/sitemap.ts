import type { MetadataRoute } from "next";
import {
  getRoleIndex, getCityIndex, getCountryIndex, getAllCompanySlugs, getRoleLevelIndex, getRolePlaceIndex,
  getRoutablePlaces, getLastRefreshed, isConfigured,
} from "@/lib/data";
import { SITE_URL as BASE } from "@/lib/site";

export const revalidate = 3600;

// ONLY publishing pages: every URL here renders a real median (or, for the
// hubs and content pages, real live content) and is indexable. Gated pages are
// noindex and left out; they enter the sitemap on their own the hour their
// slice clears the gate, because both read the same index functions.
//
// lastmod is the real last data refresh (max job_postings.last_seen) for every
// data-driven page. Pages whose content is not data-driven (/add,
// /for-companies) carry no lastmod rather than an invented one.
// No #fragment URLs (crawlers drop the fragment — they were duplicates of
// /leaderboards) and no /?role=&city= query URLs (on-site search, noindex;
// replaced by the real role×city pages).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const refreshed = isConfigured ? await getLastRefreshed() : null;
  const lastModified = refreshed ? new Date(refreshed) : undefined;
  const page = (path: string, priority: number, live = true): MetadataRoute.Sitemap[number] =>
    ({ url: `${BASE}${path}`, priority, ...(live && lastModified ? { lastModified } : {}) });

  const out: MetadataRoute.Sitemap = [
    page("/", 1), page("/roles", 0.9), page("/locations", 0.9), page("/locations/countries", 0.9),
    page("/companies", 0.8), page("/leaderboards", 0.8), page("/methodology", 0.5),
    page("/for-companies", 0.3, false), page("/add", 0.3, false),
  ];
  if (!isConfigured) return out;

  const [roles, roleLevels, rolePlaces, cities, countries, places, companySlugs] = await Promise.all([
    getRoleIndex(), getRoleLevelIndex(), getRolePlaceIndex(), getCityIndex(), getCountryIndex(),
    getRoutablePlaces(), getAllCompanySlugs(),
  ]);
  const routableCity = new Set(places.cities), routableCountry = new Set(places.countries);

  for (const r of roles) if (r.median != null) out.push(page(`/roles/${r.slug}`, 0.8));
  for (const rl of roleLevels) if (rl.hasMedian) out.push(page(`/roles/${rl.slug}/${rl.levelSlug}`, 0.6));
  for (const rp of rolePlaces) if (rp.hasMedian) out.push(page(`/roles/${rp.slug}/${rp.kind}/${rp.placeSlug}`, 0.7));
  for (const c of cities) if (c.median != null && routableCity.has(c.name)) out.push(page(`/locations/${c.slug}`, 0.6));
  for (const c of countries) if (c.median != null && routableCountry.has(c.name)) out.push(page(`/locations/country/${c.slug}`, 0.7));
  for (const s of companySlugs) out.push(page(`/companies/${s}`, 0.6));
  return out;
}
