// Country -> ISO 3166-1 alpha-2, for our canonical EMEA country names (geo.ts).
// Used to render a consistent inline flag on country and city rows.
export const COUNTRY_ISO2: Record<string, string> = {
  "United Kingdom": "GB", Germany: "DE", France: "FR", Italy: "IT", Spain: "ES",
  Netherlands: "NL", Ireland: "IE", Portugal: "PT", Poland: "PL", Sweden: "SE",
  Finland: "FI", Denmark: "DK", Norway: "NO", Belgium: "BE", Austria: "AT",
  Switzerland: "CH", Czechia: "CZ", Romania: "RO", Greece: "GR", Hungary: "HU",
  Bulgaria: "BG", Lithuania: "LT", Latvia: "LV", Estonia: "EE", Croatia: "HR",
  Slovakia: "SK", Slovenia: "SI", Serbia: "RS", Ukraine: "UA", Turkey: "TR",
  Luxembourg: "LU", Cyprus: "CY", Malta: "MT", Iceland: "IS",
  "Saudi Arabia": "SA", "United Arab Emirates": "AE", Israel: "IL", Egypt: "EG",
  "South Africa": "ZA", Nigeria: "NG", Kenya: "KE", Morocco: "MA", Tunisia: "TN",
  Qatar: "QA", Kuwait: "KW", Bahrain: "BH", Oman: "OM", Georgia: "GE",
};

export function iso2(country: string | null | undefined): string | null {
  if (!country) return null;
  return COUNTRY_ISO2[country] ?? null;
}

// ISO2 -> emoji flag (regional-indicator pair). A genuinely inline, consistent
// glyph set on the platforms we target; null when we don't have a mapping.
export function flagEmoji(country: string | null | undefined): string | null {
  const code = iso2(country);
  if (!code) return null;
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}
