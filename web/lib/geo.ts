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
