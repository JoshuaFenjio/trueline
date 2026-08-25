// Single source of truth for the site's public origin. Everything that emits an
// absolute URL — sitemap, robots, canonical/OG metadata, share links — reads
// this, so moving to a custom domain is an env change, never a code change.
//
// Deliberately NOT falling back to VERCEL_URL: that is the per-deployment
// hostname (trueline-<hash>.vercel.app), which changes on every push and sits
// behind deployment protection. Emitting it in a sitemap or a canonical would
// point crawlers at a URL that 302s to a login page and dies on the next deploy.
const FALLBACK = "https://trueline-azure.vercel.app";

// Trailing slashes stripped so `${SITE_URL}/sitemap.xml` can't become a "//".
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || FALLBACK).trim().replace(/\/+$/, "");

/** Absolute URL for a site-relative path. */
export function absoluteUrl(path = "/"): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
