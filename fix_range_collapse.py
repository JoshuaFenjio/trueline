#!/usr/bin/env python3
# =============================================================================
# fix_range_collapse.py — re-parse rows whose salary came from the text parser
# (salary_source in 'parsed','parsed_prose') with the fixed _RANGE_RE that now
# tolerates a currency symbol between the two ends of a range ("€70,000 -
# €90,000"). Restores the true max where the old parse collapsed to min==max.
# All sanity gates apply (parser + sanitize_range). Structured rows are NOT
# touched — their min/max came from ATS fields, not this parser.
#
#   python3 fix_range_collapse.py            # DRY RUN: corrections + median shift
#   python3 fix_range_collapse.py --apply    # PATCH corrected rows in Supabase
# =============================================================================
import concurrent.futures as cf
import os
import statistics
import sys
import time

import requests

from pipeline import parse_salary_from_text, sanitize_range, normalize_period, to_eur

REST = os.environ["SUPABASE_URL"].rstrip("/") + "/rest/v1/job_postings"
KEY = os.environ["SUPABASE_SERVICE_KEY"]
H = {"apikey": KEY, "Authorization": "Bearer " + KEY}
EMEA_CUR = {"EUR", "GBP", "CHF", "SEK", "DKK", "NOK", "PLN"}
PAGE = 500
ANNUAL = {"year": 1, "month": 12, "week": 52, "day": 260, "hour": 2080}


def fetch(source):
    out, offset = [], 0
    cols = "id,description,salary_min,salary_max,currency,salary_period,salary_eur_min,salary_eur_max,salary_source"
    while True:
        r = requests.get(REST, headers=dict(H, **{"Range": f"{offset}-{offset+PAGE-1}"}),
                         params={"salary_source": f"eq.{source}", "order": "id.asc", "select": cols}, timeout=90)
        r.raise_for_status()
        batch = r.json()
        out.extend(batch)
        if len(batch) < PAGE:
            return out
        offset += PAGE


def annual_mid(eur_min, eur_max, period):
    """Annualised EUR midpoint — matches how the site compares pay across periods."""
    if not eur_min:
        return None
    hi = eur_max or eur_min
    return (eur_min + hi) / 2 * ANNUAL.get(period or "year", 1)


def patch(rows):
    hh = dict(H, **{"Content-Type": "application/json", "Prefer": "return=minimal"})
    fails = [0]

    def one(row):
        rid = row.pop("id")
        for _ in range(3):
            try:
                r = requests.patch(REST + "?id=eq." + str(rid), headers=hh, json=row, timeout=60)
                if r.status_code < 300:
                    return
            except Exception:
                time.sleep(1)
        fails[0] += 1

    with cf.ThreadPoolExecutor(max_workers=12) as ex:
        list(ex.map(one, rows))
    return fails[0]


def main():
    apply = "--apply" in sys.argv
    rows = fetch("parsed") + fetch("parsed_prose")
    print(f"fetched {len(rows)} parsed + parsed_prose rows")

    updates = []                 # rows to PATCH
    corrected_before, corrected_after = [], []   # annualised midpoints of corrected EMEA rows
    all_before, all_after = [], []                # annualised midpoints of ALL EMEA rows in this set
    n_collapsed_fixed = 0        # old min==max -> new max>min
    n_other_changed = 0          # any other (min,max) change
    n_reparse_none = 0           # fixed parser no longer finds a salary (left untouched)

    for row in rows:
        cur = (row.get("currency") or "").upper()
        old_min, old_max = row.get("salary_min"), row.get("salary_max")
        emea = cur in EMEA_CUR and row.get("salary_eur_min")
        if emea:
            all_before.append(annual_mid(row["salary_eur_min"], row.get("salary_eur_max"), row.get("salary_period")))

        parsed = parse_salary_from_text(row.get("description") or "")
        if not parsed:
            n_reparse_none += 1
            if emea:
                all_after.append(annual_mid(row["salary_eur_min"], row.get("salary_eur_max"), row.get("salary_period")))
            continue

        period = normalize_period(parsed["period"]) or "year"
        smin, smax, source = sanitize_range(parsed["min"], parsed["max"], row["salary_source"], period)
        ncur = (parsed["currency"] or "").upper()
        neur_min, neur_max = to_eur(smin, ncur), to_eur(smax, ncur)
        old_period = row.get("salary_period") or "year"

        # TARGETED to the collapse bug ONLY: the row was a collapsed single figure
        # (min==max), and the fixed parser now restores a real range whose LOW end,
        # currency, period and source are all unchanged — i.e. only the dropped high
        # end comes back. Any other difference is unrelated parser drift; leave it.
        is_collapse_fix = (
            old_min is not None and old_max is not None and old_min == old_max
            and smin == old_min and smax and smax > smin
            and ncur == cur and period == old_period and source == row["salary_source"]
        )
        if is_collapse_fix:
            n_collapsed_fixed += 1
            updates.append({"id": row["id"], "salary_min": smin, "salary_max": smax,
                            "salary_eur_min": neur_min, "salary_eur_max": neur_max})
            if ncur in EMEA_CUR and neur_min:
                corrected_before.append(annual_mid(row.get("salary_eur_min"), row.get("salary_eur_max"), old_period))
                corrected_after.append(annual_mid(neur_min, neur_max, period))
        else:
            # count what we're deliberately NOT touching, for transparency
            if (smin != old_min) or (smax != old_max) or (period != old_period) or (ncur != cur):
                n_other_changed += 1
        # midpoint AFTER for the global set (corrected value only when we apply it)
        if emea:
            if is_collapse_fix and ncur in EMEA_CUR and neur_min:
                all_after.append(annual_mid(neur_min, neur_max, period))
            else:
                all_after.append(annual_mid(row["salary_eur_min"], row.get("salary_eur_max"), old_period))

    cb = [x for x in corrected_before if x]
    ca = [x for x in corrected_after if x]
    ab = [x for x in all_before if x]
    aa = [x for x in all_after if x]

    print("=" * 68)
    print("RANGE-COLLAPSE FIX " + ("(APPLYING)" if apply else "(dry run)"))
    print("=" * 68)
    print(f"rows re-parsed                        : {len(rows)}")
    print(f"COLLAPSE FIXES to apply (min==max->rng): {n_collapsed_fixed}")
    print(f"unrelated parser-drift diffs (SKIPPED) : {n_other_changed}")
    print(f"fixed parser now finds nothing (kept)  : {n_reparse_none}")
    print("")
    print("MEDIAN SHIFT — corrected EMEA rows (annualised EUR midpoint)")
    if cb and ca:
        print(f"  corrected rows (n={len(ca)}): median {statistics.median(cb):,.0f} -> {statistics.median(ca):,.0f} "
              f"({statistics.median(ca)-statistics.median(cb):+,.0f})")
        print(f"  corrected rows mean        : {statistics.mean(cb):,.0f} -> {statistics.mean(ca):,.0f} "
              f"({statistics.mean(ca)-statistics.mean(cb):+,.0f})")
    print("MEDIAN SHIFT — whole parsed+parsed_prose EMEA set")
    if ab and aa:
        print(f"  set (n={len(aa)}): median {statistics.median(ab):,.0f} -> {statistics.median(aa):,.0f} "
              f"({statistics.median(aa)-statistics.median(ab):+,.0f})")

    if apply and updates:
        print(f"\napplying {len(updates)} corrections...")
        f = patch(updates)
        print("done." if f == 0 else f"done with {f} failures")


if __name__ == "__main__":
    main()
