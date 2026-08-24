// Coarse European sub-region grouping for the location hubs' "Browse by region".
export type SubRegion = "Western Europe" | "Northern Europe" | "Southern Europe" | "Eastern Europe" | "Middle East & Africa";

const MAP: Record<string, SubRegion> = {
  "United Kingdom": "Western Europe", Ireland: "Western Europe", France: "Western Europe",
  Netherlands: "Western Europe", Belgium: "Western Europe", Luxembourg: "Western Europe",
  Germany: "Western Europe", Austria: "Western Europe", Switzerland: "Western Europe",
  Sweden: "Northern Europe", Norway: "Northern Europe", Denmark: "Northern Europe",
  Finland: "Northern Europe", Iceland: "Northern Europe", Estonia: "Northern Europe",
  Latvia: "Northern Europe", Lithuania: "Northern Europe",
  Spain: "Southern Europe", Portugal: "Southern Europe", Italy: "Southern Europe",
  Greece: "Southern Europe", Malta: "Southern Europe", Cyprus: "Southern Europe",
  Croatia: "Southern Europe", Slovenia: "Southern Europe",
  Poland: "Eastern Europe", Czechia: "Eastern Europe", Slovakia: "Eastern Europe",
  Hungary: "Eastern Europe", Romania: "Eastern Europe", Bulgaria: "Eastern Europe",
  Serbia: "Eastern Europe", Ukraine: "Eastern Europe", Georgia: "Eastern Europe",
};

export const SUBREGIONS: SubRegion[] = ["Western Europe", "Northern Europe", "Southern Europe", "Eastern Europe", "Middle East & Africa"];

export function subregionOf(country: string | null | undefined): SubRegion | null {
  if (!country) return null;
  return MAP[country] ?? "Middle East & Africa";
}
