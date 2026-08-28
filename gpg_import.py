#!/usr/bin/env python3
# =============================================================================
# gpg_import.py — UK Gender Pay Gap layer.
#
# Imports the public gov.uk GPG dataset (all employers with 250+ UK staff must
# file by law) and matches filings to the companies we track. Output is a
# display-only context module — company-reported pay quartiles, clearly sourced,
# NEVER blended into our advertised-salary medians.
#
#   python3 gpg_import.py           # print candidate matches for review
#   python3 gpg_import.py --write   # write web/lib/gpgData.ts
#
# Source: https://gender-pay-gap.service.gov.uk/viewing/download-data/<year>
# =============================================================================
import csv
import io
import json
import re
import sys
import urllib.request

from companies import COMPANIES

YEAR = 2024
CSV_URL = "https://gender-pay-gap.service.gov.uk/viewing/download-data/{}".format(YEAR)
SOURCE_PAGE = "https://gender-pay-gap.service.gov.uk/Employer/{}"  # + EmployerId

# Legal / geographic descriptor tokens stripped from the *filed* legal name so
# "MONZO BANK LIMITED" reduces toward "monzo bank".
SUFFIX = {"limited", "ltd", "plc", "llp", "llc", "group", "holdings", "holding",
          "uk", "u.k.", "international", "europe", "emea", "services", "service",
          "the", "company", "co", "inc", "gmbh", "ab", "as", "bv", "sa", "sas",
          "partnership", "trading", "global", "worldwide", "ventures"}

# False positives caught in review — our short/common name prefix-matched an
# unrelated UK filer (school trust, NHS body, housing assoc, catering, yachts…).
# Keyed by our slug.
BLACKLIST = {
    "believe", "genesis", "griffin", "hadrian", "hala", "lighthouse",
    "resilience", "shine", "symphony", "oyster", "speedy", "remote",
}


def norm(s):
    s = (s or "").lower().replace("&", " and ")
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    return [t for t in s.split() if t]


def gpg_core(name):
    toks = norm(name)
    while toks and toks[-1] in SUFFIX:
        toks.pop()
    return toks


def slugify(s):
    s = s.lower().replace("&", "and")
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")


def load_gpg():
    raw = urllib.request.urlopen(CSV_URL, timeout=60).read().decode("utf-8-sig", "replace")
    return list(csv.DictReader(io.StringIO(raw)))


def match(our_names, rows):
    # index GPG rows by core token tuple prefix (first 1-3 tokens)
    out = {}
    review = []
    by_first = {}
    for r in rows:
        core = tuple(gpg_core(r["EmployerName"]))
        if core:
            by_first.setdefault(core[0], []).append((core, r))
    for name in our_names:
        ours = norm(name)
        if not ours:
            continue
        slug = slugify(name)
        if slug in BLACKLIST:
            continue
        cands = by_first.get(ours[0], [])
        best = None
        for core, r in cands:
            if list(core[:len(ours)]) == ours:  # our name is a leading token run
                # guard: single short common token needs an exact full-name match
                if len(ours) == 1 and len(ours[0]) < 5 and list(core) != ours:
                    continue
                size = r.get("EmployerSize") or ""
                # prefer exact match, then largest headcount band
                score = (list(core) == ours, len(str(size)))
                if best is None or score > best[0]:
                    best = (score, core, r)
        if best:
            r = best[2]
            review.append((name, r["EmployerName"], r.get("EmployerSize", "")))
            out[slug] = record(name, r)
    return out, review


def pct(v):
    try:
        return round(float(v), 1)
    except (TypeError, ValueError):
        return None


def record(our_name, r):
    return {
        "employer": r["EmployerName"],
        "year": YEAR,
        "medianGapPct": pct(r.get("DiffMedianHourlyPercent")),
        "meanGapPct": pct(r.get("DiffMeanHourlyPercent")),
        "employerSize": r.get("EmployerSize") or None,
        # % women in each pay quartile (lower -> top)
        "womenByQuartile": {
            "lower": pct(r.get("FemaleLowerQuartile")),
            "lowerMiddle": pct(r.get("FemaleLowerMiddleQuartile")),
            "upperMiddle": pct(r.get("FemaleUpperMiddleQuartile")),
            "top": pct(r.get("FemaleTopQuartile")),
        },
        "sourceUrl": r.get("CompanyLinkToGPGInfo") or SOURCE_PAGE.format(r.get("EmployerId", "")),
    }


def main():
    rows = load_gpg()
    our_names = [c["name"] for c in COMPANIES]
    # include watchlist names (parsed from the TS file)
    try:
        wl = open("web/lib/watchlist.ts").read()
        our_names += re.findall(r'name:\s*"([^"]+)"', wl)
    except FileNotFoundError:
        pass
    out, review = match(sorted(set(our_names)), rows)
    print("GPG {} filers: {}".format(YEAR, len(rows)))
    print("matched {} of {} tracked companies\n".format(len(out), len(set(our_names))))
    print("{:<28} {:<40} {}".format("OUR NAME", "GPG FILING", "SIZE"))
    print("-" * 90)
    for our, gpg, size in sorted(review):
        print("{:<28} {:<40} {}".format(our[:27], gpg[:39], size))
    if "--write" in sys.argv:
        body = ("// AUTO-GENERATED by gpg_import.py — UK Gender Pay Gap filings ({year}),\n"
                "// public gov.uk data. Display-only context; never blended into medians.\n"
                "export interface GpgRecord {{\n"
                "  employer: string; year: number;\n"
                "  medianGapPct: number | null; meanGapPct: number | null;\n"
                "  employerSize: string | null;\n"
                "  womenByQuartile: {{ lower: number | null; lowerMiddle: number | null; upperMiddle: number | null; top: number | null }};\n"
                "  sourceUrl: string;\n"
                "}}\n"
                "export const GPG_BY_SLUG: Record<string, GpgRecord> = {json};\n"
                "export function gpgFor(slug: string): GpgRecord | null {{ return GPG_BY_SLUG[slug] ?? null; }}\n"
                ).format(year=YEAR, json=json.dumps(out, indent=2, ensure_ascii=False))
        open("web/lib/gpgData.ts", "w").write(body)
        print("\nwrote web/lib/gpgData.ts with", len(out), "records")


if __name__ == "__main__":
    main()
