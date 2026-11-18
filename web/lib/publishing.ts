import "server-only";
import {
  getRoleIndex, getCityIndex, getCountryIndex, getCompaniesBoard, getRoleLevelIndex, getRolePlaceIndex,
  getRoutablePlaces, isConfigured,
} from "./data";
import { familyLabel } from "./roleNames";
import { levelHeading } from "./levels";
import { inPlace } from "./seoCopy";

// The single list of indexable pages. sitemap.xml, the HTML /sitemap and
// /llms.txt all read it, so "what we publish" can't differ between them.
// A data page is here only when it renders a real median (n >= gate).
export type PageGroup = "static" | "role" | "role-level" | "role-country" | "role-city" | "country" | "city" | "company";
export interface PublishedPage { path: string; title: string; group: PageGroup; live: boolean; priority: number }

export const STATIC_PAGES: PublishedPage[] = [
  { path: "/", title: "Home", group: "static", live: true, priority: 1 },
  { path: "/roles", title: "Salaries by role", group: "static", live: true, priority: 0.9 },
  { path: "/locations", title: "Salaries by city", group: "static", live: true, priority: 0.9 },
  { path: "/locations/countries", title: "Salaries by country", group: "static", live: true, priority: 0.9 },
  { path: "/companies", title: "The Pay Index", group: "static", live: true, priority: 0.8 },
  { path: "/leaderboards", title: "Leaderboards", group: "static", live: true, priority: 0.8 },
  { path: "/insights", title: "Insights", group: "static", live: false, priority: 0.5 },
  { path: "/insights/salary-transparency-statistics", title: "Salary transparency statistics", group: "static", live: true, priority: 0.8 },
  { path: "/methodology", title: "Methodology", group: "static", live: true, priority: 0.5 },
  { path: "/sitemap", title: "All pages", group: "static", live: true, priority: 0.3 },
  { path: "/compare", title: "Compare companies", group: "static", live: false, priority: 0.3 },
  { path: "/for-companies", title: "For companies", group: "static", live: false, priority: 0.3 },
  { path: "/add", title: "Add your salary", group: "static", live: false, priority: 0.3 },
];

export async function getPublishedPages(): Promise<PublishedPage[]> {
  if (!isConfigured) return STATIC_PAGES;
  const [roles, roleLevels, rolePlaces, cities, countries, places, board] = await Promise.all([
    getRoleIndex(), getRoleLevelIndex(), getRolePlaceIndex(), getCityIndex(), getCountryIndex(),
    getRoutablePlaces(), getCompaniesBoard(),
  ]);
  const okCity = new Set(places.cities), okCountry = new Set(places.countries);
  const out: PublishedPage[] = [...STATIC_PAGES];
  const by = <T,>(xs: T[], k: (x: T) => string) => [...xs].sort((a, b) => k(a).localeCompare(k(b)));
  for (const r of by(roles.filter((r) => r.median != null), (r) => familyLabel(r.name)))
    out.push({ path: `/roles/${r.slug}`, title: `${r.name === "Other" ? "Other roles" : familyLabel(r.name)} salary in Europe`, group: "role", live: true, priority: 0.8 });
  for (const rl of roleLevels.filter((x) => x.hasMedian))
    out.push({ path: `/roles/${rl.slug}/${rl.levelSlug}`, title: `${levelHeading(rl.level, familyLabel(rl.role))} salary`, group: "role-level", live: true, priority: 0.6 });
  for (const rp of by(rolePlaces.filter((x) => x.hasMedian), (x) => familyLabel(x.role) + x.place))
    out.push({ path: `/roles/${rp.slug}/${rp.kind}/${rp.placeSlug}`, title: `${familyLabel(rp.role)} salary in ${inPlace(rp.place)}`, group: rp.kind === "city" ? "role-city" : "role-country", live: true, priority: 0.7 });
  for (const c of by(countries.filter((c) => c.median != null && okCountry.has(c.name)), (c) => c.name))
    out.push({ path: `/locations/country/${c.slug}`, title: `Salaries in ${inPlace(c.name)}`, group: "country", live: true, priority: 0.7 });
  for (const c of by(cities.filter((c) => c.median != null && okCity.has(c.name)), (c) => c.name))
    out.push({ path: `/locations/${c.slug}`, title: `Salaries in ${c.name}`, group: "city", live: true, priority: 0.6 });
  for (const c of by(board, (c) => c.company))
    out.push({ path: `/companies/${c.slug}`, title: `${c.company} salaries`, group: "company", live: true, priority: 0.6 });
  return out;
}
