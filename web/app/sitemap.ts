import type { MetadataRoute } from "next";
import { getFilterOptions, getAllCompanySlugs, isConfigured } from "@/lib/data";

const BASE = "https://trueline.vercel.app";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, changeFrequency: "daily", priority: 1 },
    { url: `${BASE}/companies`, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE}/add`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${BASE}/methodology`, changeFrequency: "monthly", priority: 0.5 },
  ];
  if (!isConfigured) return staticPages;

  const [options, slugs] = await Promise.all([getFilterOptions(), getAllCompanySlugs()]);

  // Company pages
  const companyUrls: MetadataRoute.Sitemap = slugs.map((s) => ({
    url: `${BASE}/companies/${s}`,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  // Role × city combinations (top cities only, keeps the sitemap tight).
  const topCities = options.cities.slice(0, 20);
  const roleCityUrls: MetadataRoute.Sitemap = [];
  for (const role of options.roles) {
    for (const city of topCities) {
      roleCityUrls.push({
        url: `${BASE}/?role=${encodeURIComponent(role)}&city=${encodeURIComponent(city.key)}`,
        changeFrequency: "daily",
        priority: 0.6,
      });
    }
  }

  return [...staticPages, ...companyUrls, ...roleCityUrls];
}
