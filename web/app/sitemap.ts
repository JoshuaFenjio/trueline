import type { MetadataRoute } from "next";
import {
  getRoleFamilies, getCityList, getCountryList, getAllCompanySlugs, isConfigured,
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

  const [roles, cities, countries, companySlugs] = await Promise.all([
    getRoleFamilies(), getCityList(), getCountryList(), getAllCompanySlugs(),
  ]);

  const roleUrls: MetadataRoute.Sitemap = roles.map((r) => ({
    url: `${BASE}/roles/${slugify(r)}`, changeFrequency: "daily", priority: 0.8,
  }));
  const cityUrls: MetadataRoute.Sitemap = cities.map((c) => ({
    url: `${BASE}/locations/${slugify(c.city)}`, changeFrequency: "weekly", priority: 0.6,
  }));
  const countryUrls: MetadataRoute.Sitemap = countries.map((c) => ({
    url: `${BASE}/locations/country/${slugify(c.country)}`, changeFrequency: "weekly", priority: 0.6,
  }));
  const companyUrls: MetadataRoute.Sitemap = companySlugs.map((s) => ({
    url: `${BASE}/companies/${s}`, changeFrequency: "weekly", priority: 0.7,
  }));

  // Role × city landing combinations (top cities only, keeps it tight).
  const topCities = cities.slice(0, 15);
  const roleCity: MetadataRoute.Sitemap = [];
  for (const r of roles) {
    for (const c of topCities) {
      roleCity.push({
        url: `${BASE}/?role=${encodeURIComponent(r)}&city=${encodeURIComponent(c.city)}`,
        changeFrequency: "daily", priority: 0.5,
      });
    }
  }

  return [...staticPages, ...roleUrls, ...cityUrls, ...countryUrls, ...companyUrls, ...roleCity];
}
