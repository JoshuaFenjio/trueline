#!/usr/bin/env python3
# =============================================================================
# reclassify_supabase.py — re-apply the (widened) classify_role rules to every
# stored posting in PRODUCTION Supabase. The local trueline.db is stale, so the
# SQLite-based reclassify.py can't be used; production truth lives in Supabase.
#
#   python3 reclassify_supabase.py            # DRY RUN: move table + new dist
#   python3 reclassify_supabase.py --apply    # PATCH changed rows in Supabase
#
# Needs SUPABASE_URL + SUPABASE_SERVICE_KEY in the environment.
# =============================================================================
import os
import sys
from collections import Counter

import requests

from pipeline import classify_role, classify_level

PAGE = 1000
URL = os.environ["SUPABASE_URL"].rstrip("/") + "/rest/v1/job_postings"
REST_SYN = os.environ["SUPABASE_URL"].rstrip("/") + "/rest/v1/role_synonyms"
KEY = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ["SUPABASE_KEY"]
H = {"apikey": KEY, "Authorization": "Bearer " + KEY}


def level_cols_present():
    """Have the migrations/2026-09-role-level.sql columns been applied yet?"""
    r = requests.get(URL, headers=H, params={"select": "level", "limit": 1}, timeout=30)
    return r.status_code < 300


def backfill_levels(rows, apply):
    """Compute (level, level_source) from each title and PATCH rows whose stored
    values differ — grouped by the 8 (level, source) pairs, id-chunked. Idempotent:
    a second run finds nothing to change."""
    if not level_cols_present():
        print("level columns not present — apply migrations/2026-09-role-level.sql first (skipping level backfill)")
        return
    groups = {}
    for p in rows:
        lvl, src = classify_level(p.get("title") or "")
        if p.get("level") != lvl or p.get("level_source") != src:
            groups.setdefault((lvl, src), []).append(p["id"])
    changed = sum(len(v) for v in groups.values())
    from collections import Counter as _C
    dist = _C()
    for p in rows:
        dist[classify_level(p.get("title") or "")[1]] += 1
    print("\nLEVEL BACKFILL: {} rows need level set  |  explicit {} / default {}".format(
        changed, dist.get("explicit", 0), dist.get("default", 0)))
    if not apply:
        return
    done = 0
    for (lvl, src), ids in groups.items():
        for i in range(0, len(ids), 200):
            chunk = ids[i:i + 200]
            r = requests.patch(URL, headers=dict(H, **{"Content-Type": "application/json",
                               "Prefer": "return=minimal"}),
                               params={"id": "in.({})".format(",".join(str(x) for x in chunk))},
                               json={"level": lvl, "level_source": src}, timeout=60)
            r.raise_for_status()
            done += len(chunk)
    print("  level backfill: patched {} rows".format(done))


def fetch_all():
    # Include level columns only if they exist, so this runs pre- and post-migration.
    sel = "id,title,role_family,salary_source,salary_eur_min"
    if level_cols_present():
        sel += ",level,level_source"
    out, offset = [], 0
    while True:
        r = requests.get(URL, headers=dict(H, **{"Range-Unit": "items",
                         "Range": "{}-{}".format(offset, offset + PAGE - 1)}),
                         params={"order": "id.asc",  # stable order so Range paging
                         # doesn't silently skip/duplicate rows (no ORDER BY = arbitrary)
                                 "select": sel},
                         timeout=60)
        r.raise_for_status()
        batch = r.json()
        out.extend(batch)
        if len(batch) < PAGE:
            return out
        offset += PAGE


def salaried(p):
    return p.get("salary_source") not in (None, "none") and p.get("salary_eur_min")


def apply_changes(changes):
    """PATCH rows grouped by target family, chunking id lists to keep URLs sane."""
    by_new = {}
    for rid, new in changes:
        by_new.setdefault(new, []).append(rid)
    done = 0
    for new, ids in by_new.items():
        for i in range(0, len(ids), 200):
            chunk = ids[i:i + 200]
            r = requests.patch(URL, headers=dict(H, **{"Content-Type": "application/json",
                               "Prefer": "return=minimal"}),
                               params={"id": "in.({})".format(",".join(str(x) for x in chunk))},
                               json={"role_family": new}, timeout=60)
            r.raise_for_status()
            done += len(chunk)
            print("  patched {}/{} -> {}".format(done, len(changes), new))
    return done


def fetch_synonyms():
    """Admin-approved role-request synonyms (role_synonyms table). A title
    containing an approved synonym is relabelled to that family — this is how an
    approved role request takes effect. Empty/absent table -> no overrides."""
    try:
        r = requests.get(REST_SYN, headers=H, params={"select": "synonym,family"}, timeout=30)
        if r.status_code != 200:
            return []
        return [(s["synonym"].lower(), s["family"]) for s in r.json() if s.get("synonym") and s.get("family")]
    except Exception:
        return []


def classify_with_synonyms(title, synonyms):
    t = (title or "").lower()
    for syn, fam in synonyms:
        if syn and syn in t:
            return fam
    return classify_role(title or "")


def main():
    rows = fetch_all()
    synonyms = fetch_synonyms()
    if synonyms:
        print("applying {} admin-approved synonym(s)".format(len(synonyms)))
    old_dist = Counter(p.get("role_family") for p in rows)
    new_dist = Counter()
    sal_new_dist = Counter()
    moves = Counter()
    changes = []
    samples = {}
    for p in rows:
        old = p.get("role_family")
        new = classify_with_synonyms(p.get("title") or "", synonyms)
        new_dist[new] += 1
        if salaried(p):
            sal_new_dist[new] += 1
        if new != old:
            moves[(old, new)] += 1
            changes.append((p["id"], new))
        samples.setdefault(new, [])
        if len(samples[new]) < 4 and (p.get("title") or "").strip():
            samples[new].append(p["title"].strip()[:48])

    total = len(rows)
    print("=" * 72)
    print("RECLASSIFY (dry run)" if "--apply" not in sys.argv else "RECLASSIFY (APPLYING)")
    print("=" * 72)
    print("rows: {}   changed: {}   families: {} -> {}".format(
        total, len(changes), len(old_dist), len(new_dist)))
    print("'Other': {} ({}%) -> {} ({}%)".format(
        old_dist.get("Other", 0), round(old_dist.get("Other", 0) / total * 100, 1),
        new_dist.get("Other", 0), round(new_dist.get("Other", 0) / total * 100, 1)))
    print("")
    print("NEW FAMILY DISTRIBUTION  (active / salaried / sample titles)")
    print("-" * 72)
    for fam in sorted(new_dist, key=lambda k: -sal_new_dist.get(k, 0)):
        print("{:<22} {:>6} {:>6}   {}".format(
            fam, new_dist[fam], sal_new_dist.get(fam, 0), " · ".join(samples.get(fam, []))[:64]))
    print("")
    print("TOP MOVES (old -> new)")
    print("-" * 72)
    for (old, new), n in moves.most_common(30):
        print("  {:>18} -> {:<20} {}".format(old, new, n))

    if "--apply" in sys.argv:
        print("\napplying {} changes...".format(len(changes)))
        n = apply_changes(changes)
        print("done: patched {} rows".format(n))

    # Level backfill (guarded; no-op until the migration is applied).
    backfill_levels(rows, "--apply" in sys.argv)


if __name__ == "__main__":
    main()
