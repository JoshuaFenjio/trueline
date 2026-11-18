import type { MetadataRoute } from "next";
import { getLastRefreshed, isConfigured } from "@/lib/data";
import { getPublishedPages } from "@/lib/publishing";
import { SITE_URL as BASE } from "@/lib/site";

export const revalidate = 3600;

// ONLY publishing pages (lib/publishing): every URL renders a real median or
// real live content and is indexable; gated pages are noindex and absent, and
// join on their own the hour their slice clears the gate.
// lastmod = the real last data refresh (max job_postings.last_seen) for
// data-driven pages; /add and /for-companies carry none rather than a fake one.
// No #fragment URLs, no /?role=&city= on-site search URLs.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const refreshed = isConfigured ? await getLastRefreshed() : null;
  const lastModified = refreshed ? new Date(refreshed) : undefined;
  return (await getPublishedPages()).map((p) => ({
    url: `${BASE}${p.path === "/" ? "/" : p.path}`,
    priority: p.priority,
    ...(p.live && lastModified ? { lastModified } : {}),
  }));
}
