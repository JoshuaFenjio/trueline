#!/usr/bin/env python3
# =============================================================================
# Trueline — job + salary ingestion pipeline
#
# WHAT IT DOES (in plain English):
#   1. Goes to each company in companies.py and asks their public job system
#      (their "ATS") for every job currently posted.
#   2. Normalizes every job into the same shape, and tries hard to pull a
#      salary out of it (first from real salary fields, then by reading the text).
#   3. Saves everything to a database. It NEVER deletes anything: jobs that
#      disappear are marked "expired" and kept forever as historical benchmarks.
#   4. Writes the whole run to jobs.json.
#   5. Prints a coverage report so you can see which companies are worth keeping.
#
# Safe to run over and over (it's "idempotent"): re-running just refreshes.
# One broken company can never stop the run.
# =============================================================================

import os
import re
import html
import json
import time
import sqlite3
import datetime
from typing import Optional, List, Dict, Any

import requests

# Load a local .env file if one exists (so SUPABASE_URL etc. are picked up).
try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass

from companies import COMPANIES


# -----------------------------------------------------------------------------
# CONFIG
# -----------------------------------------------------------------------------
USER_AGENT = "TruelineJobsBot/1.0 (+salary-benchmarking; contact: jobs@trueline.local)"
HTTP_TIMEOUT = 10          # seconds per request
HTTP_RETRIES = 2           # extra attempts after the first try
DELAY_BETWEEN_COMPANIES = 1.5   # polite pause (seconds) between companies
SQLITE_FILE = "trueline.db"
JSON_OUTPUT = "jobs.json"

# Approximate FX rates -> EUR. APPROXIMATE ON PURPOSE. Refresh later if you
# need precision; salaries converted with these are only for rough comparison.
FX_TO_EUR = {
    "EUR": 1.00,
    "USD": 0.92,
    "GBP": 1.17,
    "CHF": 1.05,
    "PLN": 0.23,
    "SEK": 0.088,
    "DKK": 0.134,
    "NOK": 0.086,
}

HEADERS = {"User-Agent": USER_AGENT, "Accept": "application/json"}

# We log one raw sample posting per ATS on the first run so you can confirm the
# field shapes. Tracks which ATS types we've already sampled this run.
_sampled_ats = set()


def now_iso() -> str:
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def log(msg: str) -> None:
    print(msg, flush=True)


# -----------------------------------------------------------------------------
# HTTP helper — timeout + retries, returns parsed JSON or None (never raises)
# -----------------------------------------------------------------------------
def http_get_json(url: str) -> Optional[Any]:
    last_err = None
    for attempt in range(HTTP_RETRIES + 1):
        try:
            resp = requests.get(url, headers=HEADERS, timeout=HTTP_TIMEOUT)
            if resp.status_code == 200:
                return resp.json()
            last_err = "HTTP {}".format(resp.status_code)
        except Exception as e:
            last_err = str(e)
        time.sleep(0.6 * (attempt + 1))  # small backoff between attempts
    log("    ! request failed for {} ({})".format(url, last_err))
    return None


def http_get_text(url: str) -> Optional[str]:
    """Like http_get_json but returns raw text (used for the Teamtailor RSS feed)."""
    last_err = None
    for attempt in range(HTTP_RETRIES + 1):
        try:
            resp = requests.get(url, headers=HEADERS, timeout=HTTP_TIMEOUT)
            if resp.status_code == 200:
                return resp.text
            last_err = "HTTP {}".format(resp.status_code)
        except Exception as e:
            last_err = str(e)
        time.sleep(0.6 * (attempt + 1))
    log("    ! request failed for {} ({})".format(url, last_err))
    return None


def maybe_log_sample(ats: str, raw_posting: Any) -> None:
    """On the first posting we see for each ATS, dump its raw JSON so you can
    confirm the field shapes."""
    if ats in _sampled_ats:
        return
    _sampled_ats.add(ats)
    log("\n    ----- SAMPLE RAW POSTING ({}) -----".format(ats))
    try:
        log("    " + json.dumps(raw_posting, indent=2)[:2500])
    except Exception:
        log("    " + str(raw_posting)[:2500])
    log("    ----- END SAMPLE -----\n")


# -----------------------------------------------------------------------------
# SALARY EXTRACTION
# -----------------------------------------------------------------------------
CURRENCY_SYMBOLS = {"€": "EUR", "£": "GBP", "$": "USD"}
CURRENCY_CODES = ["EUR", "GBP", "USD", "CHF", "PLN", "SEK", "DKK", "NOK"]

# Words that tell us the pay period.
PERIOD_HINTS = [
    ("hour", ["per hour", "/hour", "/hr", "an hour", "hourly", "per hr",
              "par heure", "pro stunde"]),
    ("month", ["per month", "/month", "/mo", "a month", "monthly", "pcm", "per mo",
               "pro monat", "/monat", "monatlich", "im monat", "par mois", "mensuel",
               "per maand", "al mese", "por mes", "/mois"]),
    ("year", ["per year", "/year", "/yr", "per annum", "p.a.", "annually",
              "annual", "a year", "per yr", "pro jahr", "jährlich", "par an",
              "annuel", "per jaar", "all'anno", "al año"]),
]


def _num(raw: str) -> Optional[float]:
    """Turn a money-ish string into a number. Handles 60k, 70,000, 70.000, 70000."""
    if raw is None:
        return None
    s = raw.strip().lower().replace(" ", "")
    mult = 1.0
    if s.endswith("k"):
        mult = 1000.0
        s = s[:-1]
    # Remove thousands separators. Both comma and dot can be separators in EU.
    # If there are 3 digits after the last separator, treat it as a separator.
    s = re.sub(r"[.,](?=\d{3}\b)", "", s)
    # Any remaining comma is a decimal comma -> dot.
    s = s.replace(",", ".")
    try:
        return float(s) * mult
    except ValueError:
        return None


def _detect_currency(text: str) -> Optional[str]:
    for sym, code in CURRENCY_SYMBOLS.items():
        if sym in text:
            return code
    upper = text.upper()
    for code in CURRENCY_CODES:
        if re.search(r"\b" + code + r"\b", upper):
            return code
    return None


def _detect_period(text: str) -> Optional[str]:
    low = text.lower()
    for period, hints in PERIOD_HINTS:
        for h in hints:
            if h in low:
                return period
    return None


# A number that may carry a 'k' and EU/US separators.
_NUMBER = r"\d[\d.,]*\s*k?"
# A range: number  (- – — to / "up to")  number
_RANGE_RE = re.compile(
    r"(" + _NUMBER + r")\s*(?:-|–|—|to|up to)\s*(" + _NUMBER + r")",
    re.IGNORECASE,
)
_SINGLE_RE = re.compile(r"(" + _NUMBER + r")", re.IGNORECASE)


def parse_salary_from_text(text: str):
    """Conservatively read a salary out of free text.
    Returns dict(min,max,currency,period) or None. If unsure -> None."""
    if not text:
        return None

    currency = _detect_currency(text)
    if not currency:
        # Without a currency we don't trust the numbers. Be conservative.
        return None

    # Look only near a currency mention to avoid grabbing random numbers
    # (years, headcounts, etc). Scan windows around each currency token.
    candidates = []
    markers = [m.start() for sym in CURRENCY_SYMBOLS for m in re.finditer(re.escape(sym), text)]
    for code in CURRENCY_CODES:
        markers += [m.start() for m in re.finditer(r"\b" + code + r"\b", text, re.IGNORECASE)]
    if not markers:
        return None

    explicit_period = _detect_period(text)
    period = explicit_period or "year"

    for pos in markers:
        window = text[max(0, pos - 10): pos + 40]
        rng = _RANGE_RE.search(window)
        if rng:
            lo, hi = _num(rng.group(1)), _num(rng.group(2))
            if lo and hi:
                candidates.append((min(lo, hi), max(lo, hi)))
                continue
        single = _SINGLE_RE.search(window)
        if single:
            v = _num(single.group(1))
            if v:
                candidates.append((v, v))

    # No explicit period cue, but the numbers are far too small to be an annual
    # salary (e.g. "2.000–3.500")? It's monthly — tag it so, so it's converted
    # rather than silently dropped by the annual plausibility floor.
    if explicit_period is None and candidates:
        biggest = max(hi for _, hi in candidates)
        if 0 < biggest < 10000:
            period = "month"

    # Keep only plausible salaries. Hourly numbers are small; annual are large.
    plausible = []
    for lo, hi in candidates:
        if period == "hour":
            if 3 <= lo <= 1000:
                plausible.append((lo, hi))
        elif period == "month":
            if 500 <= lo <= 100000:
                plausible.append((lo, hi))
        else:  # year
            if 10000 <= lo <= 5000000:
                plausible.append((lo, hi))

    if not plausible:
        return None

    # Use the widest plausible range we found (most informative).
    lo = min(p[0] for p in plausible)
    hi = max(p[1] for p in plausible)
    # Guard against mixed-unit parses (e.g. a monthly base merged with an annual
    # commission). A real salary range rarely spans more than ~4x; if it does,
    # the parse is unreliable — be conservative and return nothing.
    if lo > 0 and hi / lo > 4:
        return None
    return {"min": lo, "max": hi, "currency": currency, "period": period}


def to_eur(amount: Optional[float], currency: Optional[str]) -> Optional[float]:
    if amount is None or currency is None:
        return None
    rate = FX_TO_EUR.get(currency.upper())
    if rate is None:
        return None
    return round(amount * rate, 0)


def normalize_period(raw: Optional[str]) -> Optional[str]:
    if not raw:
        return None
    r = str(raw).lower()
    if "hour" in r or r in ("hourly", "hr"):
        return "hour"
    if "month" in r or r in ("monthly", "mo"):
        return "month"
    if "year" in r or "annu" in r or r in ("yearly", "yr", "annual"):
        return "year"
    return None


# -----------------------------------------------------------------------------
# ROLE FAMILY classifier
# -----------------------------------------------------------------------------
def classify_role(title: str) -> str:
    # Pad with spaces so " ml "/" pm "/" ae " word checks work at the edges.
    t = " " + (title or "").lower().replace("/", " / ") + " "

    def has(*words):
        return any(w in t for w in words)

    # --- Management / product (before IC engineering) -----------------------
    if has("engineering manager", "eng manager", "manager, engineering",
           "manager of engineering", "head of engineering", "director of engineering",
           "vp of engineering", "vp engineering", "engineering director",
           "head of platform", "director, engineering", " cto "):
        return "Engineering Manager"
    if has("product manager", "product owner", "head of product", "director of product",
           "vp of product", "group product manager", "chief product", " cpo ",
           "principal product manager", "technical product manager"):
        return "Product Manager"

    # --- Specialised engineering (most specific first) ----------------------
    if has("machine learning", "ml engineer", " ml ", "ml/ai", "ai engineer",
           "a.i. engineer", "deep learning", "nlp", "natural language",
           "computer vision", "research engineer", "llm", "genai", "gen ai",
           "applied ai", "applied ml", " ml/", "mlops", "ml ops", "ml platform",
           "prompt engineer"):
        return "ML/AI Engineer"
    if has("data engineer", "analytics engineer", "data platform", "etl ",
           "data infrastructure", "big data", "data warehouse", "data governance"):
        return "Data Engineer"
    if has("data scientist", "data science", "applied scientist",
           "research scientist", "decision scientist", "quantitative", " quant ",
           "quant researcher"):
        return "Data Scientist"
    if has("data analyst", "business analyst", "bi analyst", "insights analyst",
           "reporting analyst", "business intelligence", "bi developer",
           "analytics manager", "web analyst", "product analyst", "growth analyst"):
        return "Data Analyst"
    if has("security engineer", "application security", "appsec", "infosec",
           "information security", "security analyst", "security operations",
           "soc analyst", "penetration test", "pentest", "cyber", "security architect",
           "product security", "cloud security", "security specialist"):
        return "Security Engineer"
    if has("devops", "sre", "site reliability", "platform engineer", "infrastructure",
           "cloud engineer", "reliability engineer", "systems engineer",
           "platform team", "solutions architect", "cloud architect",
           "kubernetes", "observability"):
        return "DevOps/Platform"
    if has("qa ", "quality assurance", "test engineer", "sdet", "qa engineer",
           "test automation", "quality engineer", "tester", "in test"):
        return "QA/Test"
    if has(" ios ", "android", "mobile engineer", "mobile developer", "react native",
           "flutter", "mobile app", " ios/"):
        return "Mobile"
    if has("frontend", "front-end", "front end", "ui engineer", "ui developer",
           "react developer", "web developer", "javascript engineer"):
        return "Frontend"
    if has("backend", "back-end", "back end", "api engineer", "server engineer"):
        return "Backend"

    # --- Generic engineering / design ---------------------------------------
    if has("software", "full stack", "fullstack", "full-stack", "swe", "developer",
           "programmer", "engineer"):
        return "Software Engineer"
    if has("designer", "design lead", "ux", "ui/", "user experience",
           "product design", "graphic design", "motion design", "design system"):
        return "Designer"

    # --- Business functions -------------------------------------------------
    if has("account executive", " ae ", " ae,", "sales", "business development",
           "sales development", " sdr ", " bdr ", "account manager", "revenue",
           "commercial", "commerciale", "new business", "key account", "field sales",
           "solutions engineer", "sales engineer", "pre-sales", "presales",
           "partnerships", "partner manager", "channel sales", "go-to-market",
           " gtm ", "inside sales"):
        return "Sales/AE"
    if has("customer success", "customer support", "customer experience",
           "customer care", "client success", "customer service", "support specialist",
           "support agent", "technical support", "support engineer", "onboarding",
           "implementation", "solutions consultant"):
        return "Customer Success"
    if has("marketing", "growth", "seo", "content", "brand", "communications",
           "public relations", " pr ", "demand generation", "social media",
           "copywriter", "campaign", "community", "developer advocate",
           "developer relations", "devrel", "product marketing", "lifecycle"):
        return "Marketing"
    if has("finance", "financial", "accountant", "accounting", "controller", "fp&a",
           "treasury", " tax ", "tax ", "audit", "bookkeeper", "payroll",
           "accounts payable", "accounts receivable", "procure to pay", " risk ",
           "actuary", "actuarial", "underwrit", "financial analyst"):
        return "Finance"
    if has("people ", "human resources", " hr ", "recruiter", "recruiting",
           "talent acquisition", "talent ", "people operations", "people partner",
           "hrbp", "people & culture", "compensation & benefits",
           "learning & development", " l&d ", "hr business partner"):
        return "People/HR"
    if has("legal", "counsel", "lawyer", "paralegal", "attorney", "privacy",
           "compliance", "regulatory"):
        return "Legal"
    if has("operations", "operational", " ops ", "program manager", "project manager",
           "supply chain", "logistics", "warehouse", "procurement", "office manager",
           "chief of staff", "revops", "revenue operations", "fulfil", "facilities",
           "general manager", "country manager", "workplace", "scrum master",
           "agile coach", "delivery manager", "business operations", "biz ops",
           "strategy & operations"):
        return "Operations"
    return "Other"


# -----------------------------------------------------------------------------
# EMEA REGION FILTER
#
# Keep only postings located in Europe, the Middle East, or Africa.
# Drop clearly US / LATAM / APAC roles. If a posting has NO clear location,
# KEEP it (we never throw away something we can't positively place outside EMEA).
#
# Rule of thumb, in order:
#   1. If we recognise an EMEA place anywhere in the location -> KEEP (this also
#      rescues multi-office roles like "London / New York").
#   2. Else if we recognise a US / LATAM / APAC place -> DROP.
#   3. Else (unknown / blank / "Remote") -> KEEP.
# -----------------------------------------------------------------------------

# ISO-2 country codes (used by SmartRecruiters' structured country field).
EMEA_CC = {
    # Europe
    "gb", "uk", "ie", "fr", "de", "es", "pt", "it", "nl", "be", "lu", "ch", "at",
    "dk", "se", "no", "fi", "is", "pl", "cz", "sk", "hu", "ro", "bg", "gr", "hr",
    "si", "ee", "lv", "lt", "rs", "ua", "by", "md", "mt", "cy", "mc", "li", "ad",
    "ba", "mk", "al", "me", "xk", "ru", "sm", "ge", "am", "az",
    # Middle East
    "ae", "sa", "qa", "kw", "bh", "om", "il", "tr", "jo", "lb", "iq", "ir", "ye",
    "ps", "sy",
    # Africa
    "za", "ng", "ke", "ma", "tn", "dz", "eg", "gh", "et", "ug", "tz", "rw", "sn",
    "ci", "cm", "ao", "mz", "zm", "zw", "na", "bw", "mu", "mg", "ml", "bf", "ne",
    "td", "so", "ly", "sd", "cd", "cg", "ga", "gn", "bj", "tg",
}
NONEMEA_CC = {
    "us", "ca",  # North America
    "mx", "br", "ar", "cl", "co", "pe", "uy", "ve", "ec", "bo", "py", "cr", "pa",
    "gt", "do", "hn", "ni", "sv", "pr", "jm", "tt",  # LATAM
    "in", "cn", "jp", "sg", "au", "nz", "hk", "kr", "tw", "th", "my", "id", "ph",
    "vn", "bd", "pk", "lk", "np", "kh", "mm", "mn", "la", "bn",  # APAC
}

# Place-name signals found in free-text location strings.
EMEA_TERMS = [
    "europe", "emea", "middle east", "africa", "nordics", "benelux", "dach",
    # countries
    "united kingdom", "england", "scotland", "northern ireland", "cardiff",
    "ireland", "france", "germany", "spain", "portugal", "italy", "netherlands",
    "holland", "belgium", "luxembourg", "switzerland", "austria", "denmark",
    "sweden", "norway", "finland", "iceland", "poland", "czech", "czechia",
    "slovakia", "slovenia", "hungary", "romania", "bulgaria", "greece", "croatia",
    "serbia", "ukraine", "estonia", "latvia", "lithuania", "malta", "cyprus",
    "monaco", "turkey", "türkiye", "turkiye", "israel", "united arab emirates",
    "saudi arabia", "qatar", "kuwait", "bahrain", "oman", "jordan", "lebanon",
    "egypt", "morocco", "tunisia", "algeria", "nigeria", "kenya", "south africa",
    "ghana", "ethiopia", "uganda", "tanzania", "rwanda", "senegal",
    # cities
    "london", "manchester", "edinburgh", "dublin", "paris", "lyon", "marseille",
    "toulouse", "bordeaux", "nantes", "berlin", "munich", "hamburg", "frankfurt",
    "cologne", "stuttgart", "düsseldorf", "dusseldorf", "madrid", "barcelona",
    "valencia", "seville", "lisbon", "porto", "milan", "rome", "turin", "naples",
    "bologna", "amsterdam", "rotterdam", "utrecht", "brussels", "antwerp",
    "zurich", "geneva", "basel", "vienna", "copenhagen", "stockholm", "gothenburg",
    "oslo", "helsinki", "warsaw", "krakow", "wroclaw", "gdansk", "prague",
    "bratislava", "budapest", "bucharest", "sofia", "athens", "zagreb", "belgrade",
    "tallinn", "riga", "vilnius", "dubai", "abu dhabi", "riyadh", "jeddah", "doha",
    "tel aviv", "istanbul", "ankara", "cairo", "casablanca", "rabat", "tunis",
    "lagos", "nairobi", "accra", "cape town", "johannesburg", "pretoria",
]
NONEMEA_TERMS = [
    "united states", "usa", "u.s.", "americas", "north america", "us only",
    "us-only", "united states of america",
    # US cities
    "new york", "brooklyn", "san francisco", "bay area", "silicon valley",
    "los angeles", "san diego", "san jose", "palo alto", "mountain view",
    "menlo park", "sunnyvale", "santa clara", "seattle", "bellevue", "austin",
    "dallas", "houston", "boston", "chicago", "denver", "boulder", "atlanta",
    "miami", "washington", "arlington", "philadelphia", "phoenix", "portland",
    "nashville", "raleigh", "durham", "charlotte", "columbus", "detroit",
    "minneapolis", "salt lake city", "las vegas", "san antonio", "pittsburgh",
    "kansas city", "tampa", "orlando", "sacramento", "irvine",
    # Canada
    "canada", "toronto", "vancouver", "montreal", "montréal", "ottawa", "calgary",
    "edmonton", "waterloo", "ontario", "quebec", "québec", "british columbia",
    # LATAM
    "mexico", "méxico", "brazil", "brasil", "argentina", "chile", "colombia",
    "peru", "perú", "uruguay", "venezuela", "ecuador", "bolivia", "paraguay",
    "costa rica", "panama", "panamá", "guatemala", "latam", "latin america",
    "são paulo", "sao paulo", "rio de janeiro", "mexico city", "guadalajara",
    "monterrey", "buenos aires", "bogota", "bogotá", "lima", "santiago",
    "medellin", "medellín",
    # APAC
    "india", "china", "japan", "singapore", "australia", "new zealand",
    "hong kong", "south korea", "korea", "taiwan", "thailand", "malaysia",
    "indonesia", "philippines", "vietnam", "bangladesh", "pakistan", "sri lanka",
    "nepal", "cambodia", "myanmar", "mongolia", "apac", "asia pacific",
    "asia-pacific", "bangalore", "bengaluru", "mumbai", "new delhi", "delhi",
    "hyderabad", "chennai", "kolkata", "pune", "gurgaon", "gurugram", "noida",
    "ahmedabad", "beijing", "shanghai", "shenzhen", "guangzhou", "hangzhou",
    "tokyo", "osaka", "yokohama", "sydney", "melbourne", "brisbane", "perth",
    "auckland", "wellington", "seoul", "busan", "taipei", "bangkok",
    "kuala lumpur", "jakarta", "manila", "cebu", "ho chi minh", "hanoi",
]
# US state FULL names — the disambiguator that beats an EMEA city match, e.g.
# "Lake Zurich, Illinois". "georgia" is omitted (collides with the country
# Georgia); "Atlanta, Georgia" is still caught via the US city "atlanta".
US_STATE_NAMES = {
    "alabama", "alaska", "arizona", "arkansas", "california", "colorado",
    "connecticut", "delaware", "florida", "hawaii", "idaho", "illinois",
    "indiana", "iowa", "kansas", "kentucky", "louisiana", "maine", "maryland",
    "massachusetts", "michigan", "minnesota", "mississippi", "missouri",
    "montana", "nebraska", "nevada", "new hampshire", "new jersey", "new mexico",
    "north carolina", "north dakota", "ohio", "oklahoma", "oregon",
    "pennsylvania", "rhode island", "south carolina", "south dakota",
    "tennessee", "texas", "utah", "vermont", "virginia", "washington",
    "west virginia", "wisconsin", "wyoming",
}
CANADA_PROVINCES = {
    "ontario", "quebec", "québec", "alberta", "manitoba", "saskatchewan",
    "british columbia", "nova scotia", "new brunswick", "newfoundland",
    "prince edward island", "yukon", "nunavut", "northwest territories",
}
# Country/region names (not cities) — an EMEA country in a segment overrides a
# stray US-state match (so "Angers, Maine-et-Loire, France" stays EMEA).
EMEA_COUNTRIES = {
    "europe", "emea", "middle east", "africa", "nordics", "benelux", "dach",
    "united kingdom", "england", "scotland", "wales", "northern ireland",
    "ireland", "france", "germany", "spain", "portugal", "italy", "netherlands",
    "holland", "belgium", "luxembourg", "switzerland", "austria", "denmark",
    "sweden", "norway", "finland", "iceland", "poland", "czech", "czechia",
    "slovakia", "slovenia", "hungary", "romania", "bulgaria", "greece", "croatia",
    "serbia", "ukraine", "estonia", "latvia", "lithuania", "malta", "cyprus",
    "monaco", "turkey", "türkiye", "turkiye", "israel", "united arab emirates",
    "saudi arabia", "qatar", "kuwait", "bahrain", "oman", "jordan", "lebanon",
    "egypt", "morocco", "tunisia", "algeria", "nigeria", "kenya", "south africa",
    "ghana", "ethiopia", "uganda", "tanzania", "rwanda", "senegal",
}


def _wb(terms):
    # Word-boundary regex that also refuses to match inside hyphenated compounds,
    # so "maine" does NOT match "Maine-et-Loire" and "peru" not "Perugia".
    body = "|".join(re.escape(t) for t in sorted(terms, key=len, reverse=True))
    return re.compile(r"(?<![\w-])(" + body + r")(?![\w-])", re.IGNORECASE)


_EMEA_COUNTRY_RE = _wb(EMEA_COUNTRIES)
_EMEA_ALL_RE = _wb(set(EMEA_TERMS) | {"uk", "uae"})
_NONEMEA_RE = _wb(set(NONEMEA_TERMS))
_US_DISAMBIG_RE = _wb(US_STATE_NAMES | CANADA_PROVINCES |
                      {"united states", "usa", "canada", "north america", "us only", "us-only"})
_US_PHRASE_RE = re.compile(r"\b(us|usa)\b|\bu\.s\.?a?\.?\b", re.IGNORECASE)


def _segment_region(seg):
    """Classify one office-segment -> EMEA | NONEMEA | MULTI | UNKNOWN.

    A US STATE / Canadian province / "United States" is a *disambiguator*: when
    present without an EMEA country it converts an ambiguous city to the US
    ("Lake Zurich, Illinois" -> US). When an EMEA and a non-EMEA place appear as
    peers ("London, Paris, Toronto, New York") the segment is MULTI (kept)."""
    s = (seg or "").strip().lower()
    if not s:
        return "UNKNOWN"
    emea_country = bool(_EMEA_COUNTRY_RE.search(s))
    emea = emea_country or bool(_EMEA_ALL_RE.search(s))
    us_disambig = bool(_US_DISAMBIG_RE.search(s)) or bool(_US_PHRASE_RE.search(s))
    us_local = us_disambig or bool(_NONEMEA_RE.search(s))

    if us_disambig and not emea_country:
        return "NONEMEA"          # "Lake Zurich, Illinois", "Paris, Texas", "Remote, US"
    if emea and us_local:
        return "MULTI"            # "London, Paris, Toronto, New York"
    if emea:
        return "EMEA"
    if us_local:
        return "NONEMEA"          # "Sunnyvale", "Bangalore"
    return "UNKNOWN"


def classify_region(location, city, country):
    """Return (region, multi_market).

    region is 'EMEA' | 'NONEMEA' | 'UNKNOWN'. multi_market is True when the
    posting spans BOTH an EMEA and a non-EMEA office (e.g. 'London; Sunnyvale')
    — such roles are kept (EMEA candidates can apply) but flagged so their
    non-EMEA-currency salary can be excluded from EMEA stats.
    """
    text = " ".join([p for p in [location, city] if p])
    labels = [_segment_region(x) for x in re.split(r"[;/|\n]", text) if x.strip()]

    cc = (country or "").strip().lower()
    if cc in EMEA_CC:
        labels.append("EMEA")
    elif cc in NONEMEA_CC:
        labels.append("NONEMEA")
    elif country:
        labels.append(_segment_region(country))

    has_emea = any(l in ("EMEA", "MULTI") for l in labels)
    has_non = any(l in ("NONEMEA", "MULTI") for l in labels)
    if has_emea and has_non:
        return "EMEA", True
    if has_emea:
        return "EMEA", False
    if has_non:
        return "NONEMEA", False
    return "UNKNOWN", False


def is_emea(posting):
    """Keep EMEA and unknown-location postings; drop clearly non-EMEA ones."""
    region, _ = classify_region(posting.get("location"), posting.get("city"),
                                posting.get("country"))
    return region != "NONEMEA"


# -----------------------------------------------------------------------------
# NORMALIZE — build the standard posting record
# -----------------------------------------------------------------------------
def sanitize_range(smin, smax, source, period=None):
    """Sanity-check a parsed salary range. Returns (min, max, source).
    - min > max  -> auto-swap (a swapped-fields mix-up is recoverable).
    - digit-grouping misparse (a tiny bound with a large one, '50'-'80000')
      -> 'parsed_suspect' regardless of period.
    - width gate is PERIOD-AWARE: annual ranges may span up to 4x (director-era
      ladder bands are legitimately wide); monthly/hourly-derived ranges keep
      the strict 3x, since a wide monthly span is OTE-as-base or a unit mix.
    Values are kept for provenance; non-suspect sources are left unchanged.
    """
    if source == "none":
        return smin, smax, source
    try:
        lo = float(smin) if smin is not None else None
        hi = float(smax) if smax is not None else None
    except (TypeError, ValueError):
        return smin, smax, source
    if lo is not None and hi is not None and lo > 0 and hi > 0:
        if lo > hi:                       # inverted -> swap
            smin, smax = smax, smin
            lo, hi = hi, lo
        if lo < 1000 and hi >= 10000:     # digit-grouping truncation -> suspect
            return smin, smax, "parsed_suspect"
        annual = (period or "year").lower() == "year"
        if hi / lo > (4 if annual else 3):
            return smin, smax, "parsed_suspect"
    return smin, smax, source


def build_posting(ats, company, ats_job_id, title, location, city, country, remote,
                  posted_at, url, description,
                  structured_salary=None):
    """structured_salary, when given, is dict(min,max,currency,period)."""
    salary_min = salary_max = currency = period = None
    salary_source = "none"

    if structured_salary and (structured_salary.get("min") or structured_salary.get("max")):
        salary_min = structured_salary.get("min")
        salary_max = structured_salary.get("max")
        currency = (structured_salary.get("currency") or "").upper() or None
        period = normalize_period(structured_salary.get("period")) or "year"
        salary_source = "structured"
    else:
        parsed = parse_salary_from_text(description or "")
        if parsed:
            salary_min = parsed["min"]
            salary_max = parsed["max"]
            currency = parsed["currency"]
            period = parsed["period"]
            salary_source = "parsed"

    # Range sanity: swap an inverted pair; flag suspect ranges so stats can
    # exclude them (OTE-as-base, a monthly/annual mix, or a digit-grouping
    # misparse like "50"–"80000"). We keep the values for provenance.
    salary_min, salary_max, salary_source = sanitize_range(salary_min, salary_max, salary_source, period)

    region, multi_market = classify_region(location, city, country)

    return {
        "ats": ats,
        "company": company,
        "ats_job_id": str(ats_job_id),
        "title": title or "",
        "role_family": classify_role(title),
        "location": location,
        "city": city,
        "country": country,
        "remote": bool(remote),
        "salary_min": salary_min,
        "salary_max": salary_max,
        "currency": currency,
        "salary_period": period,
        "salary_eur_min": to_eur(salary_min, currency),
        "salary_eur_max": to_eur(salary_max, currency),
        "salary_source": salary_source,
        "posted_at": posted_at,
        "url": url,
        "description": (description or "")[:20000],  # cap stored text
        "region": region,
        "multi_market": multi_market,
    }


def _strip_html(html: Optional[str]) -> str:
    if not html:
        return ""
    text = re.sub(r"<[^>]+>", " ", html)
    text = (text.replace("&amp;", "&").replace("&nbsp;", " ")
                .replace("&lt;", "<").replace("&gt;", ">").replace("&#39;", "'"))
    return re.sub(r"\s+", " ", text).strip()


# -----------------------------------------------------------------------------
# ATS FETCHERS — one per ATS. Each returns a list of normalized postings.
# Defensive to missing fields. Never raises past the per-company guard.
# -----------------------------------------------------------------------------
def fetch_greenhouse(company, token):
    url = "https://boards-api.greenhouse.io/v1/boards/{}/jobs?content=true".format(token)
    data = http_get_json(url)
    if not data or "jobs" not in data:
        return []
    out = []
    for j in data.get("jobs", []):
        maybe_log_sample("greenhouse", j)
        content_html = j.get("content") or ""
        # Greenhouse HTML-encodes its content field.
        content_html = content_html.replace("&lt;", "<").replace("&gt;", ">").replace("&amp;", "&")
        desc = _strip_html(content_html)

        # Try a structured pay range from metadata custom fields.
        structured = None
        for meta in (j.get("metadata") or []):
            mname = str(meta.get("name", "")).lower()
            if "pay" in mname or "salary" in mname or "compensation" in mname:
                mval = meta.get("value")
                if mval:
                    structured = parse_salary_from_text(str(mval))
                    if structured:
                        break

        loc = (j.get("location") or {}).get("name")
        out.append(build_posting(
            ats="greenhouse", company=company, ats_job_id=j.get("id"),
            title=j.get("title"), location=loc, city=None, country=None,
            remote=bool(loc and "remote" in loc.lower()),
            posted_at=j.get("updated_at"), url=j.get("absolute_url"),
            description=desc, structured_salary=structured,
        ))
    return out


def fetch_lever(company, token):
    url = "https://api.lever.co/v0/postings/{}?mode=json".format(token)
    data = http_get_json(url)
    if not isinstance(data, list):
        return []
    out = []
    for j in data:
        maybe_log_sample("lever", j)
        cats = j.get("categories") or {}
        loc = cats.get("location")

        structured = None
        sr = j.get("salaryRange") or {}
        if sr.get("min") or sr.get("max"):
            structured = {
                "min": sr.get("min"), "max": sr.get("max"),
                "currency": sr.get("currency"),
                "period": sr.get("interval"),
            }
        elif j.get("salaryDescription"):
            structured = parse_salary_from_text(j.get("salaryDescription"))

        posted = j.get("createdAt")
        if isinstance(posted, (int, float)):  # Lever uses epoch millis
            posted = datetime.datetime.fromtimestamp(posted / 1000,
                                                      datetime.timezone.utc).isoformat()
        out.append(build_posting(
            ats="lever", company=company, ats_job_id=j.get("id"),
            title=j.get("text"), location=loc, city=None, country=None,
            remote=bool(loc and "remote" in str(loc).lower()),
            posted_at=posted, url=j.get("hostedUrl"),
            description=j.get("descriptionPlain"), structured_salary=structured,
        ))
    return out


def fetch_ashby(company, token):
    url = "https://api.ashbyhq.com/posting-api/job-board/{}?includeCompensation=true".format(token)
    data = http_get_json(url)
    if not data or "jobs" not in data:
        return []
    out = []
    for j in data.get("jobs", []):
        maybe_log_sample("ashby", j)

        structured = None
        comp = j.get("compensation") or {}
        # Ashby compensation can have summaryComponents with min/max.
        comps = comp.get("summaryComponents") or comp.get("compensationTiers") or []
        for c in comps:
            lo = c.get("minValue") or c.get("min")
            hi = c.get("maxValue") or c.get("max")
            if lo or hi:
                structured = {"min": lo, "max": hi,
                              "currency": c.get("currencyCode") or c.get("currency"),
                              "period": c.get("interval") or c.get("compensationType")}
                break
        if not structured:
            summary = j.get("compensationTierSummary") or comp.get("compensationTierSummary")
            if summary:
                structured = parse_salary_from_text(str(summary))

        loc = j.get("location")
        out.append(build_posting(
            ats="ashby", company=company, ats_job_id=j.get("id"),
            title=j.get("title"), location=loc, city=None, country=None,
            remote=bool(j.get("isRemote") or (loc and "remote" in str(loc).lower())),
            posted_at=j.get("publishedDate"), url=j.get("jobUrl"),
            description=j.get("descriptionPlain"), structured_salary=structured,
        ))
    return out


def fetch_smartrecruiters(company, token):
    out = []
    offset = 0
    page_size = 100
    while True:
        url = ("https://api.smartrecruiters.com/v1/companies/{}/postings"
               "?limit={}&offset={}".format(token, page_size, offset))
        data = http_get_json(url)
        if not data or "content" not in data:
            break
        content = data.get("content") or []
        if not content:
            break
        for j in content:
            maybe_log_sample("smartrecruiters", j)
            loc = j.get("location") or {}
            city = loc.get("city")
            country = loc.get("country")
            remote = bool(loc.get("remote"))
            loc_str = ", ".join([p for p in [city, country] if p]) or None
            # Salary lives in the detail endpoint; kept OFF by default for speed.
            out.append(build_posting(
                ats="smartrecruiters", company=company, ats_job_id=j.get("id"),
                title=j.get("name"), location=loc_str, city=city, country=country,
                remote=remote, posted_at=j.get("releasedDate"),
                url=(j.get("ref") or "").replace("api.smartrecruiters.com/v1/companies",
                                                 "jobs.smartrecruiters.com")
                    if j.get("ref") else j.get("applyUrl"),
                description=j.get("name"), structured_salary=None,
            ))
        offset += page_size
        if len(content) < page_size:
            break
    return out


def _to_float(v):
    try:
        return float(str(v).replace(",", "").strip())
    except (ValueError, TypeError):
        return None


def fetch_recruitee(company, token):
    url = "https://{}.recruitee.com/api/offers/".format(token)
    data = http_get_json(url)
    if not data or "offers" not in data:
        return []
    out = []
    for o in data.get("offers", []):
        maybe_log_sample("recruitee", o)

        # Recruitee exposes a structured salary dict, e.g.
        # {"min":"5253","max":"6152","period":"month","currency":"EUR"}
        structured = None
        sal = o.get("salary")
        if isinstance(sal, dict) and (sal.get("min") or sal.get("max")):
            structured = {
                "min": _to_float(sal.get("min")),
                "max": _to_float(sal.get("max")),
                "currency": sal.get("currency"),
                "period": sal.get("period"),
            }

        desc = _strip_html("{} {}".format(o.get("description") or "",
                                          o.get("requirements") or ""))
        out.append(build_posting(
            ats="recruitee", company=company, ats_job_id=o.get("id"),
            title=o.get("title"), location=o.get("location"),
            city=o.get("city"), country=o.get("country"),
            remote=bool(o.get("remote")), posted_at=o.get("created_at"),
            url=o.get("careers_url"), description=desc,
            structured_salary=structured,
        ))
    return out


def _rss_tag(block, tag):
    m = re.search(r"<" + tag + r">(.*?)</" + tag + r">", block, re.S)
    return m.group(1).strip() if m else None


def fetch_teamtailor(company, token):
    # Teamtailor has no authenticated-free JSON API, but most career sites expose
    # a clean public RSS feed at /jobs.rss. If it isn't there, skip gracefully.
    xml = http_get_text("https://{}.teamtailor.com/jobs.rss".format(token))
    if not xml or "<item>" not in xml:
        return []
    out = []
    for m in re.finditer(r"<item>(.*?)</item>", xml, re.S):
        item = m.group(1)
        maybe_log_sample("teamtailor", item[:600])

        title = html.unescape(_rss_tag(item, "title") or "")
        link = _rss_tag(item, "link")
        guid = _rss_tag(item, "guid") or link
        city = html.unescape(_rss_tag(item, "tt:city") or "") or None
        country = html.unescape(_rss_tag(item, "tt:country") or "") or None

        # First location name inside <tt:locations>, if present.
        locname = None
        loc_block = re.search(r"<tt:location>(.*?)</tt:location>", item, re.S)
        if loc_block:
            nm = _rss_tag(loc_block.group(1), "tt:name")
            if nm:
                locname = html.unescape(nm)
        loc = ", ".join([p for p in [city or locname, country] if p]) or locname

        remote_status = (_rss_tag(item, "remoteStatus") or "").lower()
        desc = _strip_html(html.unescape(_rss_tag(item, "description") or ""))

        out.append(build_posting(
            ats="teamtailor", company=company, ats_job_id=guid, title=title,
            location=loc, city=city, country=country,
            remote=("fully" in remote_status or "remote" in remote_status
                    or bool(loc and "remote" in loc.lower())),
            posted_at=_rss_tag(item, "pubDate"), url=link,
            description=desc, structured_salary=None,
        ))
    return out


FETCHERS = {
    "greenhouse": fetch_greenhouse,
    "lever": fetch_lever,
    "ashby": fetch_ashby,
    "smartrecruiters": fetch_smartrecruiters,
    "recruitee": fetch_recruitee,
    "teamtailor": fetch_teamtailor,
}


# -----------------------------------------------------------------------------
# DATABASE — abstract over SQLite (default) and Supabase REST (if configured).
# Two tables, UNIQUE on (ats, ats_job_id). Nothing is ever deleted.
# -----------------------------------------------------------------------------
POSTING_FIELDS = [
    "company", "ats", "ats_job_id", "title", "role_family", "location", "city",
    "country", "remote", "salary_min", "salary_max", "currency", "salary_period",
    "salary_eur_min", "salary_eur_max", "salary_source", "posted_at", "url",
    "description", "region", "multi_market",
]


class SQLiteDB:
    """Local zero-setup backend. The default."""

    def __init__(self, path):
        self.conn = sqlite3.connect(path)
        self.conn.row_factory = sqlite3.Row
        self._create_tables()

    def _create_tables(self):
        c = self.conn.cursor()
        c.execute("""
            CREATE TABLE IF NOT EXISTS companies (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT, ats TEXT, token TEXT,
                first_seen TEXT, last_seen TEXT,
                UNIQUE(ats, token)
            )""")
        c.execute("""
            CREATE TABLE IF NOT EXISTS job_postings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                company TEXT, ats TEXT, ats_job_id TEXT,
                title TEXT, role_family TEXT, location TEXT, city TEXT, country TEXT,
                remote INTEGER,
                salary_min REAL, salary_max REAL, currency TEXT, salary_period TEXT,
                salary_eur_min REAL, salary_eur_max REAL, salary_source TEXT,
                posted_at TEXT, url TEXT, description TEXT,
                first_seen TEXT, last_seen TEXT, expired_at TEXT, status TEXT,
                region TEXT, multi_market INTEGER,
                UNIQUE(ats, ats_job_id)
            )""")
        # Add region / multi_market to pre-existing databases (idempotent).
        for col, decl in (("region", "TEXT"), ("multi_market", "INTEGER")):
            try:
                c.execute("ALTER TABLE job_postings ADD COLUMN {} {}".format(col, decl))
            except sqlite3.OperationalError:
                pass  # column already exists
        self.conn.commit()

    def upsert_company(self, name, ats, token, ts):
        c = self.conn.cursor()
        c.execute("SELECT id FROM companies WHERE ats=? AND token=?", (ats, token))
        row = c.fetchone()
        if row:
            c.execute("UPDATE companies SET name=?, last_seen=? WHERE id=?",
                      (name, ts, row["id"]))
        else:
            c.execute("INSERT INTO companies(name, ats, token, first_seen, last_seen) "
                      "VALUES(?,?,?,?,?)", (name, ats, token, ts, ts))
        self.conn.commit()

    def upsert_posting(self, p, ts):
        """Returns True if this was a brand-new posting."""
        c = self.conn.cursor()
        c.execute("SELECT id FROM job_postings WHERE ats=? AND ats_job_id=?",
                  (p["ats"], p["ats_job_id"]))
        row = c.fetchone()
        values = [p[f] for f in POSTING_FIELDS]
        if row:
            set_clause = ", ".join("{}=?".format(f) for f in POSTING_FIELDS)
            c.execute(
                "UPDATE job_postings SET {}, last_seen=?, status='active', "
                "expired_at=NULL WHERE id=?".format(set_clause),
                values + [ts, row["id"]],
            )
            self.conn.commit()
            return False
        else:
            cols = ", ".join(POSTING_FIELDS) + ", first_seen, last_seen, status"
            ph = ", ".join(["?"] * (len(POSTING_FIELDS) + 3))
            c.execute(
                "INSERT INTO job_postings({}) VALUES({})".format(cols, ph),
                values + [ts, ts, "active"],
            )
            self.conn.commit()
            return True

    def expire_unseen(self, company, ats, seen_ids, ts):
        """Mark this company's stored postings that weren't seen this run as
        expired. Returns how many were newly expired."""
        c = self.conn.cursor()
        c.execute("SELECT ats_job_id FROM job_postings "
                  "WHERE company=? AND ats=? AND status='active'", (company, ats))
        stored = [r["ats_job_id"] for r in c.fetchall()]
        to_expire = [sid for sid in stored if sid not in seen_ids]
        for sid in to_expire:
            c.execute("UPDATE job_postings SET status='expired', expired_at=? "
                      "WHERE ats=? AND ats_job_id=?", (ts, ats, sid))
        self.conn.commit()
        return len(to_expire)

    def coverage(self):
        c = self.conn.cursor()
        c.execute("""
            SELECT company,
                   SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) AS active,
                   SUM(CASE WHEN status='active' AND salary_source!='none'
                            THEN 1 ELSE 0 END) AS with_salary
            FROM job_postings GROUP BY company""")
        return [dict(r) for r in c.fetchall()]

    def close(self):
        self.conn.close()


class SupabaseDB:
    """Supabase REST (PostgREST) backend. Used when SUPABASE_URL + SUPABASE_KEY
    are set. You must create the tables once via the SQL in the README."""

    def __init__(self, url, key):
        self.base = url.rstrip("/") + "/rest/v1"
        self.h = {
            "apikey": key,
            "Authorization": "Bearer " + key,
            "Content-Type": "application/json",
        }

    def _req(self, method, path, params=None, body=None, prefer=None):
        headers = dict(self.h)
        if prefer:
            headers["Prefer"] = prefer
        last_err = None
        for attempt in range(5):
            try:
                r = requests.request(method, self.base + path, headers=headers,
                                     params=params, json=body, timeout=HTTP_TIMEOUT)
            except requests.exceptions.RequestException as e:
                # Connection reset / timeout — back off and retry so one flaky
                # write can't abort the whole run.
                last_err = e
                time.sleep(1.5 * (attempt + 1))
                continue
            if r.status_code >= 300:
                if r.status_code in (429, 500, 502, 503, 504) and attempt < 4:
                    time.sleep(1.5 * (attempt + 1))
                    continue
                log("    ! supabase {} {} -> {} {}".format(method, path, r.status_code, r.text[:200]))
                return None
            if r.text:
                try:
                    return r.json()
                except Exception:
                    return None
            return []
        log("    ! supabase {} {} failed after retries: {}".format(method, path, last_err))
        return None

    def upsert_company(self, name, ats, token, ts):
        existing = self._req("GET", "/companies",
                             params={"ats": "eq." + ats, "token": "eq." + token,
                                     "select": "id"})
        if existing:
            self._req("PATCH", "/companies",
                     params={"ats": "eq." + ats, "token": "eq." + token},
                     body={"name": name, "last_seen": ts})
        else:
            self._req("POST", "/companies",
                     body={"name": name, "ats": ats, "token": token,
                           "first_seen": ts, "last_seen": ts})

    def upsert_posting(self, p, ts):
        existing = self._req("GET", "/job_postings",
                            params={"ats": "eq." + p["ats"],
                                    "ats_job_id": "eq." + p["ats_job_id"],
                                    "select": "id"})
        body = dict(p)
        body.update({"last_seen": ts, "status": "active", "expired_at": None})
        if existing:
            self._req("PATCH", "/job_postings",
                     params={"ats": "eq." + p["ats"],
                             "ats_job_id": "eq." + p["ats_job_id"]},
                     body=body)
            return False
        else:
            body["first_seen"] = ts
            self._req("POST", "/job_postings", body=body)
            return True

    def expire_unseen(self, company, ats, seen_ids, ts):
        stored = self._req("GET", "/job_postings",
                          params={"company": "eq." + company, "ats": "eq." + ats,
                                  "status": "eq.active", "select": "ats_job_id"}) or []
        to_expire = [r["ats_job_id"] for r in stored if r["ats_job_id"] not in seen_ids]
        for sid in to_expire:
            self._req("PATCH", "/job_postings",
                     params={"ats": "eq." + ats, "ats_job_id": "eq." + sid},
                     body={"status": "expired", "expired_at": ts})
        return len(to_expire)

    def coverage(self):
        rows = self._req("GET", "/job_postings",
                       params={"status": "eq.active",
                               "select": "company,salary_source"}) or []
        agg = {}
        for r in rows:
            a = agg.setdefault(r["company"], {"company": r["company"], "active": 0,
                                              "with_salary": 0})
            a["active"] += 1
            if r["salary_source"] != "none":
                a["with_salary"] += 1
        return list(agg.values())

    def close(self):
        pass


def open_db():
    url = os.environ.get("SUPABASE_URL")
    # Prefer the service key; fall back to the older SUPABASE_KEY name.
    key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_KEY")
    if url and key:
        log("Database: Supabase/Postgres ({})".format(url))
        return SupabaseDB(url, key)
    log("Database: local SQLite ({})".format(SQLITE_FILE))
    return SQLiteDB(SQLITE_FILE)


# -----------------------------------------------------------------------------
# MAIN RUN
# -----------------------------------------------------------------------------
def main():
    started = now_iso()
    log("=" * 70)
    log("Trueline ingestion run @ {}".format(started))
    log("=" * 70)

    db = open_db()

    all_postings = []
    total_new = 0
    total_expired = 0

    for comp in COMPANIES:
        name = comp["name"]
        ats = comp["ats"]
        token = comp["token"]
        log("\n> {} [{}:{}]".format(name, ats, token))

        fetcher = FETCHERS.get(ats)
        if not fetcher:
            log("    ! unknown ATS '{}' — skipping".format(ats))
            continue

        ts = now_iso()
        db.upsert_company(name, ats, token, ts)

        # One bad company must never stop the run.
        try:
            postings = fetcher(name, token)
        except Exception as e:
            log("    ! fetch error: {} — continuing".format(e))
            postings = []

        # EMEA-only filter: keep Europe / Middle East / Africa + unknown location.
        raw_count = len(postings)
        postings = [p for p in postings if is_emea(p)]
        dropped = raw_count - len(postings)
        log("    fetched {} postings -> {} EMEA kept ({} non-EMEA dropped)".format(
            raw_count, len(postings), dropped))

        seen_ids = set()
        new_here = 0
        for p in postings:
            seen_ids.add(p["ats_job_id"])
            try:
                if db.upsert_posting(p, ts):
                    new_here += 1
            except Exception as e:
                log("    ! db error on posting {}: {}".format(p.get("ats_job_id"), e))
        all_postings.extend(postings)

        expired_here = db.expire_unseen(name, ats, seen_ids, ts)
        total_new += new_here
        total_expired += expired_here
        if new_here or expired_here:
            log("    {} new, {} newly expired".format(new_here, expired_here))

        time.sleep(DELAY_BETWEEN_COMPANIES)

    # Always write the full run to jobs.json.
    with open(JSON_OUTPUT, "w") as f:
        json.dump({"run_at": started, "postings": all_postings}, f, indent=2)
    log("\nWrote {} postings to {}".format(len(all_postings), JSON_OUTPUT))

    print_coverage_report(db, total_new, total_expired)
    db.close()


def print_coverage_report(db, total_new, total_expired):
    rows = db.coverage()
    # Make sure EVERY company we tried appears — even ones that returned zero
    # jobs — so a wrong token shows up flagged instead of silently vanishing.
    seen = {r["company"] for r in rows}
    for comp in COMPANIES:
        if comp["name"] not in seen:
            rows.append({"company": comp["name"], "active": 0, "with_salary": 0})
    # Sort by salary % descending (companies with best salary data on top).
    def pct(r):
        return (r["with_salary"] / r["active"] * 100.0) if r["active"] else -1
    rows.sort(key=lambda r: pct(r), reverse=True)

    log("\n" + "=" * 70)
    log("COVERAGE REPORT")
    log("=" * 70)
    header = "{:<22} {:>7} {:>12} {:>9}  {}".format(
        "company", "active", "with_salary", "salary_%", "flag")
    log(header)
    log("-" * 70)

    tot_active = tot_salary = 0
    for r in rows:
        active = r["active"] or 0
        with_sal = r["with_salary"] or 0
        tot_active += active
        tot_salary += with_sal
        p = (with_sal / active * 100.0) if active else 0.0
        flag = ""
        if active == 0:
            flag = "⚠ 0 jobs (check token/ATS)"
        elif with_sal == 0:
            flag = "— no salary yet"
        log("{:<22} {:>7} {:>12} {:>8.0f}%  {}".format(
            r["company"][:22], active, with_sal, p, flag))

    log("-" * 70)
    overall = (tot_salary / tot_active * 100.0) if tot_active else 0.0
    log("TOTALS: {} companies | {} active postings | {} with salary | {:.0f}% overall".format(
        len(rows), tot_active, tot_salary, overall))
    log("CHANGES THIS RUN: {} new postings | {} newly expired".format(
        total_new, total_expired))
    log("=" * 70)


if __name__ == "__main__":
    main()
