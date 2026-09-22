#!/usr/bin/env python3
# =============================================================================
# backfill_levels.py — re-apply pipeline.classify_level to every stored posting
# in PRODUCTION Supabase, WITHOUT touching role_family.
#
# reclassify_supabase.py does both at once; when only the level taxonomy has
# changed (e.g. adding the management track) that couples an unrelated family
# re-write to the change. This does levels only.
#
#   python3 backfill_levels.py            # DRY RUN: distribution + change count
#   python3 backfill_levels.py --apply    # PATCH changed rows
#
# Needs SUPABASE_URL + SUPABASE_SERVICE_KEY in the environment. Idempotent:
# a second run finds nothing to change.
# =============================================================================
import os
import sys
from collections import Counter

import requests

from pipeline import classify_level

PAGE = 1000
URL = os.environ["SUPABASE_URL"].rstrip("/") + "/rest/v1/job_postings"
KEY = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ["SUPABASE_KEY"]
H = {"apikey": KEY, "Authorization": "Bearer " + KEY}


def fetch_all():
    out, offset = [], 0
    while True:
        r = requests.get(
            URL,
            headers=dict(H, **{"Range-Unit": "items", "Range": "{}-{}".format(offset, offset + PAGE - 1)}),
            # Stable order so Range paging can't skip or duplicate rows.
            params={"order": "id.asc", "select": "id,title,level,level_source,status,salary_source,salary_eur_min"},
            timeout=60,
        )
        r.raise_for_status()
        batch = r.json()
        out.extend(batch)
        if len(batch) < PAGE:
            return out
        offset += PAGE


def salaried(p):
    return p.get("salary_source") not in (None, "none", "parsed_suspect") and p.get("salary_eur_min")


def main():
    apply = "--apply" in sys.argv
    rows = fetch_all()
    active = [p for p in rows if p.get("status") == "active"]

    before = Counter((p.get("level"), p.get("level_source")) for p in active)
    after = Counter()
    after_sal = Counter()
    moves = Counter()
    groups = {}
    for p in rows:
        lvl, src = classify_level(p.get("title") or "")
        if p.get("status") == "active":
            after[(lvl, src)] += 1
            if salaried(p):
                after_sal[lvl] += 1
            if p.get("level") != lvl:
                moves[(p.get("level"), lvl)] += 1
        if p.get("level") != lvl or p.get("level_source") != src:
            groups.setdefault((lvl, src), []).append(p["id"])

    changed = sum(len(v) for v in groups.values())
    print("=" * 72)
    print("LEVEL BACKFILL " + ("(APPLYING)" if apply else "(dry run)"))
    print("=" * 72)
    print("rows: {}  active: {}  need patch: {}\n".format(len(rows), len(active), changed))
    print("{:<18} {:>8} {:>8} {:>10}".format("LEVEL (active)", "before", "after", "salaried"))
    print("-" * 48)
    levels = sorted({k[0] for k in list(before) + list(after)}, key=lambda x: (x is None, str(x)))
    for lvl in levels:
        b = sum(v for k, v in before.items() if k[0] == lvl)
        a = sum(v for k, v in after.items() if k[0] == lvl)
        print("{:<18} {:>8} {:>8} {:>10}".format(str(lvl), b, a, after_sal.get(lvl, 0)))
    print("\nsource after: explicit {} / default {}".format(
        sum(v for k, v in after.items() if k[1] == "explicit"),
        sum(v for k, v in after.items() if k[1] == "default")))
    print("\nTOP MOVES (old -> new, active rows)")
    print("-" * 48)
    for (old, new), n in moves.most_common(20):
        print("  {:>16} -> {:<18} {}".format(str(old), str(new), n))

    if not apply:
        print("\n(dry run — pass --apply to write)")
        return
    done = 0
    for (lvl, src), ids in groups.items():
        for i in range(0, len(ids), 200):
            chunk = ids[i:i + 200]
            r = requests.patch(
                URL,
                headers=dict(H, **{"Content-Type": "application/json", "Prefer": "return=minimal"}),
                params={"id": "in.({})".format(",".join(str(x) for x in chunk))},
                json={"level": lvl, "level_source": src},
                timeout=60,
            )
            r.raise_for_status()
            done += len(chunk)
    print("\npatched {} rows".format(done))


if __name__ == "__main__":
    main()
