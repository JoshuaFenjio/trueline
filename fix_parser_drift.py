#!/usr/bin/env python3
# =============================================================================
# fix_parser_drift.py — re-parse the salary_source in ('parsed','parsed_prose')
# rows whose stored min/max/period was produced by an OLDER version of the text
# parser, and where today's parser reads the same description differently. Same
# class of fix as fix_range_collapse.py (better parser, old rows) but not scoped
# to the collapse signature — the new reading may move up OR down.
#
# APPLIES ONLY WHEN, for a row:
#   * today's parser returns a salary (not None), AND
#   * it still passes every gate clean — sanitize_range keeps the SAME source
#     tag (never silently demote a live row to parsed_suspect here), AND
#   * the change is MATERIAL: period flips, currency flips, or native min/max
#     moves >=2% (and >= 500 absolute). Trivial rounding diffs are left alone.
# Provenance (salary_source) is preserved. Rows the new parser can't read are
# left untouched (that's the separate "finds nothing" set).
#
#   python3 fix_parser_drift.py            # DRY RUN: corrected count + median shift
#   python3 fix_parser_drift.py --apply    # PATCH the drifted rows in Supabase
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
REL_TOL = 0.02      # >=2% move on either endpoint counts as material
ABS_TOL = 500       # ...and at least 500 in native currency (kills rounding noise)


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
    if not eur_min:
        return None
    hi = eur_max or eur_min
    return (eur_min + hi) / 2 * ANNUAL.get(period or "year", 1)


def rel_move(old, new):
    if old is None or new is None:
        return 0.0
    if abs(new - old) < ABS_TOL:
        return 0.0
    return abs(new - old) / max(abs(old), 1.0)


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

    updates = []
    before, after = [], []          # annualised EUR midpoints of corrected EMEA rows
    n_period, n_currency, n_updown = 0, 0, [0, 0]
    n_skip_immaterial = 0
    n_skip_suspect = 0              # new reading would demote to suspect -> left as-is
    n_none = 0
    samples = []                    # (id, old..., new..., desc snippet) for eyeballing

    for row in rows:
        parsed = parse_salary_from_text(row.get("description") or "")
        if not parsed:
            n_none += 1
            continue
        old_min, old_max = row.get("salary_min"), row.get("salary_max")
        old_cur = (row.get("currency") or "").upper()
        old_period = row.get("salary_period") or "year"

        period = normalize_period(parsed["period"]) or "year"
        smin, smax, source = sanitize_range(parsed["min"], parsed["max"], row["salary_source"], period)
        ncur = (parsed["currency"] or "").upper()

        # Skip the collapse case (handled by fix_range_collapse.py) and no-ops.
        if smin == old_min and smax == old_max and period == old_period and ncur == old_cur:
            continue
        # Gate: must still pass clean at the SAME provenance — never demote here.
        if source != row["salary_source"] or not smin:
            n_skip_suspect += 1
            continue
        # Materiality
        period_changed = period != old_period
        currency_changed = ncur != old_cur
        moved = rel_move(old_min, smin) >= REL_TOL or rel_move(old_max, smax) >= REL_TOL
        if not (period_changed or currency_changed or moved):
            n_skip_immaterial += 1
            continue

        neur_min, neur_max = to_eur(smin, ncur), to_eur(smax, ncur)
        updates.append({"id": row["id"], "salary_min": smin, "salary_max": smax,
                        "currency": ncur or None, "salary_period": period,
                        "salary_eur_min": neur_min, "salary_eur_max": neur_max})
        if period_changed:
            n_period += 1
        if currency_changed:
            n_currency += 1
        if len(samples) < 14:
            import re as _re
            d = row.get("description") or ""
            m = _re.search(r".{0,32}[€£].{0,44}", d)
            snip = _re.sub(r"\s+", " ", (m.group(0) if m else d[:70])).strip()
            samples.append((row["id"], old_min, old_max, old_period, smin, smax, period, snip[:78]))
        if old_cur in EMEA_CUR and row.get("salary_eur_min") and ncur in EMEA_CUR and neur_min:
            b = annual_mid(row["salary_eur_min"], row.get("salary_eur_max"), old_period)
            a = annual_mid(neur_min, neur_max, period)
            before.append(b); after.append(a)
            if a is not None and b is not None:
                n_updown[0 if a >= b else 1] += 1

    b = [x for x in before if x]
    a = [x for x in after if x]
    print("=" * 68)
    print("PARSER-DRIFT FIX " + ("(APPLYING)" if apply else "(dry run)"))
    print("=" * 68)
    print(f"rows re-parsed                     : {len(rows)}")
    print(f"MATERIAL drift corrections to apply: {len(updates)}")
    print(f"  ...of which period changed       : {n_period}")
    print(f"  ...of which currency changed     : {n_currency}")
    print(f"  ...EMEA midpoint up / down       : {n_updown[0]} up / {n_updown[1]} down")
    print(f"immaterial diffs (<2%, SKIPPED)    : {n_skip_immaterial}")
    print(f"would demote to suspect (SKIPPED)  : {n_skip_suspect}")
    print(f"parser finds nothing (kept)        : {n_none}")
    print("")
    print("MEDIAN SHIFT — corrected EMEA rows (annualised EUR midpoint)")
    if b and a:
        print(f"  corrected rows (n={len(a)}): median {statistics.median(b):,.0f} -> {statistics.median(a):,.0f} "
              f"({statistics.median(a)-statistics.median(b):+,.0f})")
        print(f"  corrected rows mean        : {statistics.mean(b):,.0f} -> {statistics.mean(a):,.0f} "
              f"({statistics.mean(a)-statistics.mean(b):+,.0f})")

    if samples:
        print("\nSAMPLE corrections (old -> new  |  min/max/period):")
        for sid, omin, omax, op, nmin, nmax, np_, snip in samples:
            print(f"  #{sid}: {omin:.0f}-{omax:.0f}/{op} -> {nmin:.0f}-{nmax:.0f}/{np_}   \"{snip}\"")

    if apply and updates:
        print(f"\napplying {len(updates)} corrections...")
        f = patch(updates)
        print("done." if f == 0 else f"done with {f} failures")


if __name__ == "__main__":
    main()
