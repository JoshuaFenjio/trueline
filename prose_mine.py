#!/usr/bin/env python3
# =============================================================================
# prose_mine.py — recover salaries from the stored description text of every row
# that has salary_source='none' (incl. EXPIRED rows — recovered pay deepens the
# trend history). Uses the pipeline's own (now multilingual) parser + the same
# sanity gates. Provenance-tagged: clean parses -> 'parsed_prose', flagged ones
# -> 'parsed_suspect' (excluded from medians, like every other suspect row).
# NEVER touches rows that already carry a salary.
#
#   python3 prose_mine.py            # DRY RUN: report recoverable count
#   python3 prose_mine.py --apply    # PATCH the recovered rows in Supabase
# =============================================================================
import concurrent.futures as cf
import os
import sys
import time
from collections import Counter

import requests

from pipeline import parse_salary_from_text, sanitize_range, normalize_period, to_eur, FX_TO_EUR

REST = os.environ["SUPABASE_URL"].rstrip("/") + "/rest/v1/job_postings"
KEY = os.environ["SUPABASE_SERVICE_KEY"]
H = {"apikey": KEY, "Authorization": "Bearer " + KEY}
EMEA_CUR = {"EUR", "GBP", "CHF", "SEK", "DKK", "NOK", "PLN"}  # in FX_TO_EUR & EMEA
PAGE = 500


def rows_page(offset):
    for _ in range(4):
        try:
            r = requests.get(REST, headers=dict(H, **{"Range": f"{offset}-{offset+PAGE-1}"}),
                             params={"salary_source": "eq.none", "description": "neq.",
                                     "order": "id.asc",
                                     "select": "id,description,status"}, timeout=90)
            if r.status_code >= 300:
                time.sleep(2); continue
            return r.json()
        except Exception:
            time.sleep(2)
    return []


def patch(rows):
    # Per-id PATCH (a partial update can't be batched with distinct bodies, and an
    # upsert-POST would trip NOT NULL on the INSERT half). Threaded for throughput.
    hh = dict(H, **{"Content-Type": "application/json", "Prefer": "return=minimal"})
    fails = [0]

    def one(row):
        rid = row.pop("id")
        for _ in range(3):
            try:
                r = requests.patch(REST + "?id=eq." + str(rid), headers=hh, json=row, timeout=60)
                if r.status_code < 300:
                    return True
            except Exception:
                time.sleep(1)
        fails[0] += 1
        return False

    done = 0
    with cf.ThreadPoolExecutor(max_workers=12) as ex:
        for _ in ex.map(one, rows):
            done += 1
            if done % 500 == 0:
                print("  patched {}/{} ...".format(done, len(rows)))
    return fails[0] == 0


def main():
    apply = "--apply" in sys.argv
    offset = 0
    scanned = 0
    updates = []
    src_counter = Counter()
    usable = 0
    while True:
        batch = rows_page(offset)
        if not batch:
            break
        for row in batch:
            scanned += 1
            parsed = parse_salary_from_text(row.get("description") or "")
            if not parsed:
                continue
            period = normalize_period(parsed["period"]) or "year"
            smin, smax, source = sanitize_range(parsed["min"], parsed["max"], "parsed_prose", period)
            cur = (parsed["currency"] or "").upper()
            eur_min = to_eur(smin, cur)
            eur_max = to_eur(smax, cur)
            src_counter[source] += 1
            if source == "parsed_prose" and cur in EMEA_CUR and eur_min:
                usable += 1
            updates.append({
                "id": row["id"], "salary_min": smin, "salary_max": smax,
                "currency": cur or None, "salary_period": period,
                "salary_eur_min": eur_min, "salary_eur_max": eur_max,
                "salary_source": source,
            })
        offset += PAGE
        if len(batch) < PAGE:
            break
        if offset % 5000 == 0:
            print("  scanned {}... recovered {}".format(scanned, len(updates)))

    print("=" * 66)
    print("PROSE-MINE " + ("(APPLYING)" if apply else "(dry run)"))
    print("=" * 66)
    print("scanned salary_source='none' rows : {}".format(scanned))
    print("salaries recovered                : {}".format(len(updates)))
    for s, n in src_counter.most_common():
        print("  {:<18} {}".format(s, n))
    print("clean 'parsed_prose' & EMEA-usable: {}".format(usable))

    if apply and updates:
        print("\napplying {} updates...".format(len(updates)))
        ok = patch(updates)
        print("done." if ok else "FAILED")


if __name__ == "__main__":
    main()
