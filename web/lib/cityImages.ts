import { slugify } from "./format";

// Places (cities OR countries) that have a curated hero photo in
// /public/cities/<slug>.jpg. Drop the file AND add its slug here; until then the
// place renders the tinted-silhouette hero automatically. Photos must be
// public-domain or Unsplash-license (see /public/cities/README.md). Gating on an
// explicit set (rather than guessing the path) avoids broken-image flashes for
// the ~two dozen places that don't have a photo yet.
const WITH_PHOTO = new Set<string>([
  // "london", "berlin", "paris", "amsterdam", ... add a slug once its file exists
]);

export function placePhoto(name: string): string | null {
  const slug = slugify(name);
  return WITH_PHOTO.has(slug) ? `/cities/${slug}.jpg` : null;
}
