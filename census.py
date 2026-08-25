#!/usr/bin/env python3
# =============================================================================
# census.py — a snapshot of what the dataset actually supports.
#
# The web app hides any number computed from too small a sample (see
# web/lib/data.ts). This script reports the dataset against those same gates,
# so "we added 700 companies" can be checked against "...and this many markets
# actually crossed the line".
#
#   python3 census.py                 # read live Supabase, print the census
#   python3 census.py --save before   # also write census-before.json
#   python3 census.py --diff before   # print before/after deltas
#
# Gates mirrored from web/lib/data.ts:
#   N_MEDIAN   8   postings needed before a median is shown at all
#   N_COMPANY  3   postings needed before a company is ranked
#   N_FLAGSHIP 15  postings needed for the map's headline "#1 country" slot
#   PRESENCE   8   postings needed for a country to count as "present"
# =============================================================================

import json
import os
import re
import sys
from collections import Counter, defaultdict

import requests

N_MEDIAN = 8
N_COMPANY = 3
N_FLAGSHIP = 15
PRESENCE = 8

PAGE = 1000

GEO_TS = "web/lib/geo.ts"


def _parse_ts_map(src, name):
    """Pull a `const NAME: Record<string,string> = { ... }` literal out of geo.ts.

    The census MUST bucket countries the same way the site does — raw rows carry
    'de', 'Germany' and 'Deutschland' for the same market, and counting those
    separately would report gates as un-cleared when the site has them cleared.
    Parsing the real map (rather than re-typing it here) keeps the two in step.
    """
    m = re.search(r"const\s+" + name + r"\s*:\s*Record<string,\s*string>\s*=\s*\{(.*?)\n\};",
                  src, re.S)
    if not m:
        raise SystemExit("census: could not find {} in {}".format(name, GEO_TS))
    out = {}
    for quoted, bare, value in re.findall(
            r'(?:"([^"]+)"|(\w[\wÀ-ɏ]*))\s*:\s*"([^"]+)"', m.group(1)):
        out[(quoted or bare).lower()] = value
    return out


_geo_src = open(GEO_TS, encoding="utf-8").read()
COUNTRY_ALIASES = _parse_ts_map(_geo_src, "COUNTRY_ALIASES")
CITY_COUNTRY = _parse_ts_map(_geo_src, "CITY_COUNTRY")


def clean_city_raw(raw):
    s = (raw or "").strip()
    s = re.sub(r"\(.*?\)", " ", s)
    s = s.split(" - ")[0]
    s = re.sub(r"\b(main office|head office|office|hq|headquarters)\b", " ", s, flags=re.I)
    s = re.sub(r"[·,/|].*$", "", s)
    return re.sub(r"\s+", " ", s).strip()


REMOTE_TOKENS = {"remote", "europe", "emea", "anywhere", "worldwide", "global"}


def resolve_country(raw_city, raw_country):
    """Port of resolvePlace() in web/lib/geo.ts — city first, then country field."""
    from_field = COUNTRY_ALIASES.get((raw_country or "").strip().lower())
    key = clean_city_raw(raw_city or "").lower()
    if not key or key in REMOTE_TOKENS:
        return from_field
    if key in COUNTRY_ALIASES:
        return COUNTRY_ALIASES[key]
    return CITY_COUNTRY.get(key) or from_field


def fetch_all():
    """Page through active postings. PostgREST caps a response at 1000 rows,
    so a single GET would silently truncate a 40k-row table."""
    url = os.environ["SUPABASE_URL"].rstrip("/") + "/rest/v1/job_postings"
    key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ["SUPABASE_KEY"]
    h = {"apikey": key, "Authorization": "Bearer " + key}
    out = []
    offset = 0
    while True:
        r = requests.get(url, headers=dict(h, **{"Range-Unit": "items",
                                                 "Range": "{}-{}".format(offset, offset + PAGE - 1)}),
                         params={"status": "eq.active",
                                 "select": "company,country,city,role_family,"
                                           "salary_eur_min,salary_eur_max,salary_source"},
                         timeout=60)
        r.raise_for_status()
        batch = r.json()
        out.extend(batch)
        if len(batch) < PAGE:
            return out
        offset += PAGE


def salaried(p):
    return p.get("salary_source") not in (None, "none") and p.get("salary_eur_min")


def census(rows):
    total = len(rows)
    sal = [p for p in rows if salaried(p)]

    for p in rows:
        p["_cc"] = resolve_country(p.get("city"), p.get("country"))

    by_country = Counter(p["_cc"] for p in rows if p["_cc"])
    sal_by_country = Counter(p["_cc"] for p in sal if p["_cc"])
    by_role = Counter(p["role_family"] for p in rows if p.get("role_family"))
    sal_by_role = Counter(p["role_family"] for p in sal if p.get("role_family"))
    by_company = Counter(p["company"] for p in rows)
    sal_by_company = Counter(p["company"] for p in sal)
    by_city = Counter(p["city"] for p in rows if p.get("city"))
    sal_by_city = Counter(p["city"] for p in sal if p.get("city"))

    return {
        "companies_with_postings": len(by_company),
        "companies_disclosing": sum(1 for c, n in sal_by_company.items() if n > 0),
        "postings_total": total,
        "postings_salaried": len(sal),
        "disclosure_pct": round(len(sal) / total * 100, 1) if total else 0,
        "countries_present": sorted(c for c, n in by_country.items() if n >= PRESENCE),
        "countries_median_gate": sorted(c for c, n in sal_by_country.items() if n >= N_MEDIAN),
        "countries_flagship_gate": sorted(c for c, n in sal_by_country.items() if n >= N_FLAGSHIP),
        "cities_median_gate": sorted(c for c, n in sal_by_city.items() if n >= N_MEDIAN),
        "roles_median_gate": sorted(r for r, n in sal_by_role.items() if n >= N_MEDIAN),
        "companies_ranked": sum(1 for c, n in sal_by_company.items() if n >= N_COMPANY),
        "country_counts": dict(by_country),
        "country_salaried": dict(sal_by_country),
        "role_counts": dict(by_role),
        "role_salaried": dict(sal_by_role),
    }


def by_ats(rows):
    """Disclosure rate per ATS — needs companies.py for the ats mapping."""
    from companies import COMPANIES
    ats_of = {c["name"]: c["ats"] for c in COMPANIES}
    agg = defaultdict(lambda: {"active": 0, "salaried": 0, "companies": set(),
                               "disclosing": set()})
    for p in rows:
        a = ats_of.get(p["company"])
        if not a:
            continue
        agg[a]["active"] += 1
        agg[a]["companies"].add(p["company"])
        if salaried(p):
            agg[a]["salaried"] += 1
            agg[a]["disclosing"].add(p["company"])
    return {a: {"active": v["active"], "salaried": v["salaried"],
                "companies": len(v["companies"]), "disclosing": len(v["disclosing"]),
                "pct": round(v["salaried"] / v["active"] * 100, 1) if v["active"] else 0}
            for a, v in agg.items()}


def render(c, ats):
    L = []
    L.append("=" * 72)
    L.append("TRUELINE CENSUS")
    L.append("=" * 72)
    L.append("companies with live postings : {}".format(c["companies_with_postings"]))
    L.append("companies disclosing pay     : {}".format(c["companies_disclosing"]))
    L.append("companies ranked (n>={})      : {}".format(N_COMPANY, c["companies_ranked"]))
    L.append("active postings              : {}".format(c["postings_total"]))
    L.append("...with a salary             : {} ({}%)".format(
        c["postings_salaried"], c["disclosure_pct"]))
    L.append("")
    L.append("COUNTRY GATES")
    L.append("{:<6} {:>8} {:>9}  {}".format("cc", "active", "salaried", "gates cleared"))
    L.append("-" * 72)
    for cc in sorted(c["country_counts"], key=lambda k: -c["country_salaried"].get(k, 0)):
        n, s = c["country_counts"][cc], c["country_salaried"].get(cc, 0)
        g = []
        if n >= PRESENCE:
            g.append("present")
        if s >= N_MEDIAN:
            g.append("median")
        if s >= N_FLAGSHIP:
            g.append("flagship")
        L.append("{:<6} {:>8} {:>9}  {}".format(cc, n, s, ", ".join(g) or "—"))
    L.append("")
    L.append("ROLE COVERAGE")
    L.append("{:<22} {:>8} {:>9}  {}".format("role", "active", "salaried", "gate"))
    L.append("-" * 72)
    for r in sorted(c["role_counts"], key=lambda k: -c["role_salaried"].get(k, 0)):
        n, s = c["role_counts"][r], c["role_salaried"].get(r, 0)
        L.append("{:<22} {:>8} {:>9}  {}".format(
            r, n, s, "median" if s >= N_MEDIAN else "—"))
    L.append("")
    L.append("PER-ATS DISCLOSURE")
    L.append("{:<18} {:>6} {:>11} {:>8} {:>9} {:>7}".format(
        "ats", "cos", "disclosing", "active", "salaried", "pct"))
    L.append("-" * 72)
    for a in sorted(ats, key=lambda k: -ats[k]["pct"]):
        v = ats[a]
        L.append("{:<18} {:>6} {:>11} {:>8} {:>9} {:>6}%".format(
            a, v["companies"], v["disclosing"], v["active"], v["salaried"], v["pct"]))
    L.append("=" * 72)
    return "\n".join(L)


def main():
    rows = fetch_all()
    c = census(rows)
    a = by_ats(rows)
    print(render(c, a))

    if "--save" in sys.argv:
        tag = sys.argv[sys.argv.index("--save") + 1]
        with open("census-{}.json".format(tag), "w") as f:
            json.dump({"census": c, "ats": a}, f, indent=2)
        print("\nsaved census-{}.json".format(tag))

    if "--diff" in sys.argv:
        tag = sys.argv[sys.argv.index("--diff") + 1]
        with open("census-{}.json".format(tag)) as f:
            old = json.load(f)["census"]
        print("\n" + "=" * 72)
        print("DELTA vs {}".format(tag))
        print("=" * 72)
        for k in ("companies_with_postings", "companies_disclosing", "companies_ranked",
                  "postings_total", "postings_salaried"):
            print("{:<28} {:>8} -> {:>8}  ({:+})".format(k, old[k], c[k], c[k] - old[k]))
        for k in ("countries_present", "countries_median_gate", "countries_flagship_gate",
                  "cities_median_gate", "roles_median_gate"):
            gained = sorted(set(c[k]) - set(old[k]))
            lost = sorted(set(old[k]) - set(c[k]))
            print("{:<28} {:>8} -> {:>8}  gained: {}  lost: {}".format(
                k, len(old[k]), len(c[k]), ", ".join(gained) or "—", ", ".join(lost) or "—"))


if __name__ == "__main__":
    main()
