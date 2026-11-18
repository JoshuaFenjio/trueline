// SEO + structured-data layer.
//
// One rule governs everything here: every JSON-LD value is produced from the
// SAME variable the page renders visibly. Builders take the already-computed,
// already-rounded figures the page shows (never a fresh query, never a
// different rounding), so schema can't drift from on-page content — Google's
// structured-data policy, and our own "no invented numbers" rule.
//
// What we deliberately never emit: JobPosting. We aggregate other employers'
// postings into salary estimates; we are not the application site, and marking
// our pages up as job postings would misrepresent that.
import { absoluteUrl } from "./site";
import type { Spread } from "./stats";

export const BRAND = "SalaryRadar";
export const BRAND_DESCRIPTION =
  "SalaryRadar publishes salary estimates for Europe, the Middle East and Africa, computed from the base pay advertised in live job postings on company job boards. It is a salary-estimate provider, not a job board or application site.";

/** Calendar year for titles — computed at render, so it rolls over on its own. */
export function currentYear(): number {
  return new Date().getUTCFullYear();
}

/** "November 2026" from an ISO stamp (the real last refresh), or null. */
export function monthYear(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return new Date(t).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

/**
 * Round to the nearest €1,000 — the precision every visible figure uses
 * (format.eur). Schema carries the identical rounded integer so the markup
 * and the page say the same number.
 */
export const r1k = (n: number) => Math.round(n / 1000) * 1000;

/** Display figure that matches r1k exactly ("€65,000"). */
export const eurExact = (n: number) => "€" + r1k(n).toLocaleString("en-IE");

/** A spread rounded once, for both the visible percentile strip and the schema. */
export interface RoundedSpread { n: number; p10: number; p25: number; median: number; p75: number; p90: number }
export function roundSpread(sp: Spread): RoundedSpread {
  return { n: sp.n, p10: r1k(sp.p10), p25: r1k(sp.p25), median: r1k(sp.median), p75: r1k(sp.p75), p90: r1k(sp.p90) };
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------
/** JSON for a <script type="application/ld+json">, with "<" escaped so a
 *  stray "</script>" in a company or role name can't break out of the tag. */
export function ldJson(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------
export type LdLocation =
  | { kind: "emea" }
  | { kind: "country"; name: string }
  | { kind: "city"; name: string; country: string | null };

function placeNode(loc: LdLocation) {
  if (loc.kind === "country") return { "@type": "Country", name: loc.name };
  if (loc.kind === "city") {
    return loc.country
      ? { "@type": "City", name: loc.name, containedInPlace: { "@type": "Country", name: loc.country } }
      : { "@type": "City", name: loc.name };
  }
  // EMEA-wide pages. Not a City/State/Country, so we say exactly what the
  // page covers rather than pretend it is one market.
  return { "@type": "Place", name: "Europe, the Middle East and Africa (EMEA)" };
}

/**
 * Occupation with an estimated-salary distribution, following Google's
 * (since-retired) estimated-salary structured-data spec: name,
 * occupationLocation, estimatedSalary as MonetaryAmountDistribution (name
 * "base", currency, duration P1Y, percentile10/25/median/75/90), sampleSize,
 * and mainEntityOfPage.lastReviewed. MonetaryAmountDistribution has no
 * unitText property — duration "P1Y" is how the spec expresses "per year".
 *
 * Callers MUST pass only publishing slices (n >= the median gate); there is no
 * fallback path here because a gated page must emit no salary schema at all.
 */
export function occupationLd(p: {
  name: string; path: string; description: string; location: LdLocation;
  spread: RoundedSpread; lastRefreshedIso: string | null; pageTitle: string;
}) {
  const url = absoluteUrl(p.path);
  const webPage: Record<string, unknown> = {
    "@type": "WebPage", "@id": url, url, name: p.pageTitle,
    mainEntity: { "@id": `${url}#occupation` },
    publisher: { "@id": absoluteUrl("/#organization") },
  };
  if (p.lastRefreshedIso) { webPage.dateModified = p.lastRefreshedIso; webPage.lastReviewed = p.lastRefreshedIso; }
  return {
    "@context": "https://schema.org",
    "@graph": [
      webPage,
      {
        "@type": "Occupation",
        "@id": `${url}#occupation`,
        name: p.name,
        description: p.description,
        mainEntityOfPage: { "@id": url },
        occupationLocation: [placeNode(p.location)],
        estimatedSalary: [{
          "@type": "MonetaryAmountDistribution",
          name: "base",
          currency: "EUR",
          duration: "P1Y",
          percentile10: p.spread.p10,
          percentile25: p.spread.p25,
          median: p.spread.median,
          percentile75: p.spread.p75,
          percentile90: p.spread.p90,
        }],
        sampleSize: p.spread.n,
      },
    ],
  };
}

export interface Crumb { label: string; href?: string }
export function breadcrumbLd(items: Crumb[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => {
      const el: Record<string, unknown> = { "@type": "ListItem", position: i + 1, name: it.label };
      // Google allows the last crumb (the current page) to omit `item`; we
      // only link what is visibly linked.
      if (it.href) el.item = absoluteUrl(it.href.split("#")[0]);
      return el;
    }),
  };
}

export interface Faq { q: string; a: string }
export function faqLd(faqs: Faq[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question", name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

export function itemListLd(name: string, items: { name: string; href: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    numberOfItems: items.length,
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, url: absoluteUrl(it.href) })),
  };
}

/** Organization — no sameAs: we have no live social profiles to point at, and
 *  the footer's social icons are placeholders. An invented sameAs is worse
 *  than none. Add real profile URLs here when they exist. */
export function organizationLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": absoluteUrl("/#organization"),
    name: BRAND,
    url: absoluteUrl("/"),
    logo: { "@type": "ImageObject", url: absoluteUrl("/logo.png"), width: 512, height: 512 },
    description: BRAND_DESCRIPTION,
  };
}

/** WebSite + SearchAction. The homepage parses ?q= into a role/city search
 *  (lib/parseQuery), so the target is a real, working search URL. */
export function websiteLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": absoluteUrl("/#website"),
    name: BRAND,
    url: absoluteUrl("/"),
    publisher: { "@id": absoluteUrl("/#organization") },
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${absoluteUrl("/")}?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

export function datasetLd(p: {
  name: string; description: string; path: string; dateModified: string | null;
  variableMeasured: string[]; spatialCoverage: string; keywords?: string[];
}) {
  const d: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: p.name,
    description: p.description,
    url: absoluteUrl(p.path),
    creator: { "@type": "Organization", "@id": absoluteUrl("/#organization"), name: BRAND, url: absoluteUrl("/") },
    isAccessibleForFree: true,
    measurementTechnique: "Median and percentiles of advertised annual base salaries from live job postings, currency-normalised to EUR, published only when a slice has at least 8 salaried postings.",
    variableMeasured: p.variableMeasured,
    spatialCoverage: { "@type": "Place", name: p.spatialCoverage },
  };
  if (p.keywords) d.keywords = p.keywords;
  if (p.dateModified) d.dateModified = p.dateModified;
  return d;
}

// ---------------------------------------------------------------------------
// Indexing
// ---------------------------------------------------------------------------
/** robots meta for a page whose data sits below the publishing gate. Flips
 *  back to indexable on its own the moment the slice clears the gate, because
 *  it is derived from the same `publishing` flag that decides what renders. */
export function robotsFor(publishing: boolean) {
  return publishing ? undefined : { index: false, follow: true };
}
