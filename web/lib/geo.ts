// Geography normalization. Raw location strings are messy ("Berlin Office",
// "Munich - Berlin", "Spain (Remote)", "United Kingdom", "Milano"). We resolve
// each to a canonical { city, country } and keep a city -> country map.

// Canonical EMEA countries + aliases (ISO-2, informal names).
const COUNTRY_ALIASES: Record<string, string> = {
  uk: "United Kingdom", gb: "United Kingdom", "united kingdom": "United Kingdom",
  england: "United Kingdom", scotland: "United Kingdom", wales: "United Kingdom",
  "great britain": "United Kingdom", "republic of ireland": "Ireland",
  ireland: "Ireland", ie: "Ireland",
  de: "Germany", germany: "Germany", deutschland: "Germany",
  fr: "France", france: "France",
  es: "Spain", spain: "Spain", españa: "Spain",
  pt: "Portugal", portugal: "Portugal",
  it: "Italy", italy: "Italy", italia: "Italy",
  nl: "Netherlands", netherlands: "Netherlands", "the netherlands": "Netherlands",
  be: "Belgium", belgium: "Belgium",
  ch: "Switzerland", switzerland: "Switzerland",
  at: "Austria", austria: "Austria",
  dk: "Denmark", denmark: "Denmark",
  se: "Sweden", sweden: "Sweden",
  no: "Norway", norway: "Norway",
  fi: "Finland", finland: "Finland",
  pl: "Poland", poland: "Poland",
  cz: "Czechia", czechia: "Czechia", "czech republic": "Czechia",
  sk: "Slovakia", slovakia: "Slovakia",
  hu: "Hungary", hungary: "Hungary",
  ro: "Romania", romania: "Romania",
  bg: "Bulgaria", bulgaria: "Bulgaria",
  gr: "Greece", greece: "Greece",
  hr: "Croatia", croatia: "Croatia",
  si: "Slovenia", slovenia: "Slovenia",
  ee: "Estonia", estonia: "Estonia",
  lv: "Latvia", latvia: "Latvia",
  lt: "Lithuania", lithuania: "Lithuania",
  rs: "Serbia", serbia: "Serbia",
  ua: "Ukraine", ukraine: "Ukraine",
  lu: "Luxembourg", luxembourg: "Luxembourg",
  ge: "Georgia", georgia: "Georgia",
  mt: "Malta", malta: "Malta",
  cy: "Cyprus", cyprus: "Cyprus",
  ae: "United Arab Emirates", uae: "United Arab Emirates",
  "united arab emirates": "United Arab Emirates",
  il: "Israel", israel: "Israel",
  tr: "Turkey", turkey: "Turkey", türkiye: "Turkey",
  sa: "Saudi Arabia", "saudi arabia": "Saudi Arabia",
  eg: "Egypt", egypt: "Egypt",
  ma: "Morocco", morocco: "Morocco",
  za: "South Africa", "south africa": "South Africa",
  ng: "Nigeria", nigeria: "Nigeria",
  ke: "Kenya", kenya: "Kenya",
};

// City (normalized lowercase) -> canonical country.
const CITY_COUNTRY: Record<string, string> = {
  london: "United Kingdom", manchester: "United Kingdom", leeds: "United Kingdom",
  cardiff: "United Kingdom", edinburgh: "United Kingdom", glasgow: "United Kingdom",
  bristol: "United Kingdom", birmingham: "United Kingdom", cambridge: "United Kingdom",
  oxford: "United Kingdom", brighton: "United Kingdom", "milton keynes": "United Kingdom",
  dublin: "Ireland", cork: "Ireland",
  berlin: "Germany", munich: "Germany", hamburg: "Germany", frankfurt: "Germany",
  cologne: "Germany", stuttgart: "Germany", dusseldorf: "Germany", "düsseldorf": "Germany",
  leipzig: "Germany", "munich - berlin": "Germany",
  paris: "France", lyon: "France", marseille: "France", toulouse: "France",
  bordeaux: "France", nantes: "France", lille: "France", nice: "France",
  madrid: "Spain", barcelona: "Spain", valencia: "Spain", seville: "Spain",
  malaga: "Spain", bilbao: "Spain",
  lisbon: "Portugal", porto: "Portugal", lisboa: "Portugal",
  milan: "Italy", milano: "Italy", rome: "Italy", turin: "Italy", naples: "Italy",
  bologna: "Italy", salerno: "Italy", genoa: "Italy", genova: "Italy",
  amsterdam: "Netherlands", rotterdam: "Netherlands", utrecht: "Netherlands",
  "the hague": "Netherlands", eindhoven: "Netherlands",
  brussels: "Belgium", antwerp: "Belgium", ghent: "Belgium",
  zurich: "Switzerland", geneva: "Switzerland", basel: "Switzerland", lausanne: "Switzerland",
  vienna: "Austria",
  copenhagen: "Denmark", aarhus: "Denmark",
  stockholm: "Sweden", gothenburg: "Sweden", malmo: "Sweden",
  oslo: "Norway", bergen: "Norway",
  helsinki: "Finland", espoo: "Finland", tampere: "Finland",
  warsaw: "Poland", warszawa: "Poland", krakow: "Poland", "kraków": "Poland",
  wroclaw: "Poland", "wrocław": "Poland", gdansk: "Poland", "gdańsk": "Poland",
  poznan: "Poland",
  prague: "Czechia", praha: "Czechia", brno: "Czechia",
  bratislava: "Slovakia",
  budapest: "Hungary",
  bucharest: "Romania", cluj: "Romania",
  sofia: "Bulgaria",
  athens: "Greece", thessaloniki: "Greece",
  zagreb: "Croatia",
  ljubljana: "Slovenia",
  tallinn: "Estonia",
  riga: "Latvia",
  vilnius: "Lithuania", kaunas: "Lithuania",
  belgrade: "Serbia",
  luxembourg: "Luxembourg",
  tbilisi: "Georgia",
  valletta: "Malta",
  dubai: "United Arab Emirates", "abu dhabi": "United Arab Emirates",
  "tel aviv": "Israel", jerusalem: "Israel", haifa: "Israel",
  istanbul: "Turkey", ankara: "Turkey",
  cairo: "Egypt",
  casablanca: "Morocco", rabat: "Morocco",
  "cape town": "South Africa", johannesburg: "South Africa",
  lagos: "Nigeria", nairobi: "Kenya",
};

// Display-name aliases for cities (canonical spelling).
const CITY_DISPLAY: Record<string, string> = {
  milano: "Milan", genova: "Genoa", warszawa: "Warsaw", praha: "Prague",
  lisboa: "Lisbon", "munich - berlin": "Munich", "kraków": "Krakow",
  "wrocław": "Wroclaw", "düsseldorf": "Düsseldorf",
};

const REMOTE_TOKENS = ["remote", "europe", "emea", "anywhere", "worldwide", "global"];

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

// Strip office/HQ suffixes, parentheticals, and everything after " - ".
export function cleanCityRaw(raw: string): string {
  let s = (raw || "").trim();
  s = s.replace(/\(.*?\)/g, " "); // drop "(Remote)" etc.
  s = s.split(" - ")[0]; // "Manchester - Main Office" -> "Manchester"
  s = s.replace(/\b(main office|head office|office|hq|headquarters)\b/gi, " ");
  s = s.replace(/[·,/|].*$/, ""); // keep first segment
  return s.replace(/\s+/g, " ").trim();
}

export interface Place {
  city: string | null;
  country: string | null;
  remote: boolean;
}

// Resolve a posting's raw city/location/country into canonical { city, country }.
export function resolvePlace(rawCity: string | null, rawCountry: string | null): Place {
  const cleaned = cleanCityRaw(rawCity || "");
  const key = cleaned.toLowerCase();

  // Country field fallback (ISO code or name).
  const countryFromField = rawCountry
    ? COUNTRY_ALIASES[rawCountry.trim().toLowerCase()] || null
    : null;

  if (!cleaned || REMOTE_TOKENS.includes(key)) {
    return { city: null, country: countryFromField, remote: true };
  }
  // The "city" is actually a country name.
  if (COUNTRY_ALIASES[key]) {
    return { city: null, country: COUNTRY_ALIASES[key], remote: false };
  }
  const country = CITY_COUNTRY[key] || countryFromField || null;
  const city = CITY_DISPLAY[key] || titleCase(cleaned);
  return { city, country, remote: false };
}

// ---------------------------------------------------------------------------
// Region classification (mirrors pipeline.py classify_region). Splits a posting
// into office-segments on ; / | and, WITHIN each segment, checks US-state /
// non-EMEA locality BEFORE EMEA city names — so "Lake Zurich, Illinois" resolves
// to the US, not Switzerland. multiMarket = spans both an EMEA and a non-EMEA
// office (kept for EMEA candidates, but its non-EMEA-currency pay is excluded).
// ---------------------------------------------------------------------------
// Non-EMEA cities/countries (word-boundary; \b already stops "lima"⊂"Limassol",
// "peru"⊂"Perugia", "arlington"⊂"Darlington").
const NON_RE =
  /\b(united states|north america|americas?|us[- ]only|new york|brooklyn|san francisco|bay area|silicon valley|los angeles|san diego|san jose|palo alto|mountain view|menlo park|sunnyvale|santa clara|seattle|bellevue|austin|dallas|houston|boston|chicago|denver|boulder|atlanta|miami|arlington|philadelphia|phoenix|portland|nashville|raleigh|durham|charlotte|columbus|detroit|minneapolis|salt lake city|las vegas|san antonio|pittsburgh|kansas city|tampa|orlando|sacramento|irvine|washington|canada|toronto|vancouver|montreal|ottawa|calgary|edmonton|waterloo|ontario|quebec|british columbia|mexico|brazil|brasil|argentina|chile|colombia|peru|uruguay|venezuela|ecuador|latam|latin america|s[aã]o paulo|mexico city|buenos aires|bogota|lima|santiago|india|china|japan|singapore|australia|new zealand|hong kong|korea|taiwan|thailand|malaysia|indonesia|philippines|vietnam|apac|asia pacific|bangalore|bengaluru|mumbai|delhi|hyderabad|chennai|pune|gurgaon|beijing|shanghai|shenzhen|tokyo|osaka|sydney|melbourne|seoul|taipei|bangkok|jakarta|manila)\b/i;
// US state / Canadian province / non-EMEA country = a DISAMBIGUATOR. Hyphen-safe
// lookarounds so "maine" does not match "Maine-et-Loire".
const US_DISAMBIG_RE =
  /(?<![\w-])(alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new hampshire|new jersey|new mexico|north carolina|north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|south dakota|tennessee|texas|utah|vermont|virginia|west virginia|wisconsin|wyoming|ontario|quebec|québec|alberta|manitoba|saskatchewan|british columbia|nova scotia|new brunswick|newfoundland|prince edward island|yukon|nunavut|united states|usa|canada|north america|us[- ]only)(?![\w-])/i;
const US_PHRASE_RE = /\b(us|usa)\b|\bu\.s\.?a?\.?\b/i;
const NON_CC = new Set(["us", "ca", "mx", "br", "ar", "cl", "co", "pe", "uy", "ve",
  "ec", "in", "cn", "jp", "sg", "au", "nz", "hk", "kr", "tw", "th", "my", "id", "ph", "vn"]);

function wbRe(words: string[]): RegExp {
  return new RegExp("(?<![\\w-])(" + words
    .sort((a, b) => b.length - a.length)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")(?![\\w-])", "i");
}
// EMEA country/region names (not cities) — an EMEA country overrides a stray
// US-state match in the same segment.
const EMEA_COUNTRY_RE = wbRe([
  ...Object.values(COUNTRY_ALIASES).map((s) => s.toLowerCase()),
  "europe", "emea", "middle east", "africa", "nordics", "benelux", "dach",
]);
// Any EMEA signal (countries + cities).
const EMEA_RE = wbRe([
  ...Object.values(COUNTRY_ALIASES).map((s) => s.toLowerCase()),
  ...Object.keys(CITY_COUNTRY), "europe", "emea", "middle east", "africa", "uk", "uae",
]);

type Seg = "EMEA" | "NONEMEA" | "MULTI" | "UNKNOWN";
function segRegion(seg: string): Seg {
  const l = seg.toLowerCase();
  const emeaCountry = EMEA_COUNTRY_RE.test(l);
  const emea = emeaCountry || EMEA_RE.test(l);
  const usDisambig = US_DISAMBIG_RE.test(l) || US_PHRASE_RE.test(l);
  const usLocal = usDisambig || NON_RE.test(l);
  if (usDisambig && !emeaCountry) return "NONEMEA";
  if (emea && usLocal) return "MULTI";
  if (emea) return "EMEA";
  if (usLocal) return "NONEMEA";
  return "UNKNOWN";
}

export interface RegionTag { region: "EMEA" | "NONEMEA" | "UNKNOWN"; multiMarket: boolean; }

export function classifyRegion(location: string | null, city: string | null, country: string | null): RegionTag {
  const text = [location, city].filter(Boolean).join(" ");
  const labels: Seg[] = text.split(/[;/|\n]/).map((s) => s.trim()).filter(Boolean).map(segRegion);
  const cc = (country || "").trim().toLowerCase();
  if (cc && COUNTRY_ALIASES[cc]) labels.push("EMEA");
  else if (NON_CC.has(cc)) labels.push("NONEMEA");
  else if (country) labels.push(segRegion(country));

  const hasE = labels.some((l) => l === "EMEA" || l === "MULTI");
  const hasN = labels.some((l) => l === "NONEMEA" || l === "MULTI");
  if (hasE && hasN) return { region: "EMEA", multiMarket: true };
  if (hasE) return { region: "EMEA", multiMarket: false };
  if (hasN) return { region: "NONEMEA", multiMarket: false };
  return { region: "UNKNOWN", multiMarket: false };
}
