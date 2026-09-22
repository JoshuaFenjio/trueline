import type { MetadataRoute } from "next";
import {
  getRoleFamilies, getCityList, getAllCompanySlugs, getRoleLevelIndex, getRoutablePlaces, isConfigured,
} from "@/lib/data";
import { slugify } from "@/lib/format";
import { SITE_URL as BASE } from "@/lib/site";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, changeFrequency: "daily", priority: 1 },
    { url: `${BASE}/leaderboards`, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE}/companies`, changeFrequency: "daily", priority: 0.8 },
    { url: `${BASE}/add`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${BASE}/methodology`, changeFrequency: "monthly", priority: 0.5 },
  ];
  // Leaderboard section anchors
  for (const a of ["overall", "by-sector", "by-role", "countries", "transparent"]) {
    staticPages.push({ url: `${BASE}/leaderboards#${a}`, changeFrequency: "daily", priority: 0.6 });
  }
  if (!isConfigured) return staticPages;

  // Places come from getRoutablePlaces, not getCityList/getCountryList: the
  // latter include places whose page 404s, and a sitemap must only contain URLs
  // that resolve. getCityList is still used for the role x city combinations,
  // which are homepage queries rather than place pages.
  const [roles, cityRanked, places, companySlugs, roleLevels] = await Promise.all([
    getRoleFamilies(), getCityList(), getRoutablePlaces(), getAllCompanySlugs(), getRoleLevelIndex(),
  ]);
  const { cities, countries } = places;

  const roleUrls: MetadataRoute.Sitemap = roles.map((r) => ({
    url: `${BASE}/roles/${slugify(r)}`, changeFrequency: "daily", priority: 0.8,
  }));
  // Role × level pages — only the combinations that clear the median gate, so we
  // never point search engines at an honest empty state.
  const roleLevelUrls: MetadataRoute.Sitemap = roleLevels
    .filter((rl) => rl.hasMedian)
    .map((rl) => ({
      url: `${BASE}/roles/${rl.slug}/${rl.levelSlug}`, changeFrequency: "weekly", priority: 0.6,
    }));
  const cityUrls: MetadataRoute.Sitemap = cities.map((c) => ({
    url: `${BASE}/locations/${slugify(c)}`, changeFrequency: "weekly", priority: 0.6,
  }));
  const countryUrls: MetadataRoute.Sitemap = countries.map((c) => ({
    url: `${BASE}/locations/country/${slugify(c)}`, changeFrequency: "weekly", priority: 0.6,
  }));
  const companyUrls: MetadataRoute.Sitemap = companySlugs.map((s) => ({
    url: `${BASE}/companies/${s}`, changeFrequency: "weekly", priority: 0.7,
  }));

  // Role × city landing combinations (top cities only, keeps it tight).
  // Only cities that also have their own page, so a query URL never advertises
  // a market we can't stand behind.
  const routable = new Set(cities);
  const topCities = cityRanked.filter((c) => routable.has(c.city)).slice(0, 15);
  const roleCity: MetadataRoute.Sitemap = [];
  for (const r of roles) {
    for (const c of topCities) {
      roleCity.push({
        url: `${BASE}/?role=${encodeURIComponent(r)}&city=${encodeURIComponent(c.city)}`,
        changeFrequency: "daily", priority: 0.5,
      });
    }
  }

  return [...staticPages, ...roleUrls, ...roleLevelUrls, ...cityUrls, ...countryUrls, ...companyUrls, ...roleCity];
}
