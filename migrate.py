#!/usr/bin/env python3
# =============================================================================
# migrate.py — push everything from the local trueline.db (SQLite) into Supabase.
#
# WHAT IT DOES:
#   Copies the companies and job_postings tables from your local database up to
#   Supabase. It is IDEMPOTENT: it upserts on the unique keys, so running it
#   again just refreshes rows instead of creating duplicates. Nothing is deleted.
#
# BEFORE RUNNING (once):
#   1. In Supabase -> SQL Editor, run the contents of schema.sql.
#   2. Put SUPABASE_URL and SUPABASE_SERVICE_KEY in .env.
#
# RUN:
#   source venv/bin/activate
#   python3 migrate.py
# =============================================================================

import os
import sys
import json
import sqlite3

import requests

try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass

SQLITE_FILE = "trueline.db"
BATCH = 500

URL = os.environ.get("SUPABASE_URL")
KEY = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_KEY")

if not URL or not KEY:
    sys.exit("ERROR: set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env first.")

REST = URL.rstrip("/") + "/rest/v1"
HEADERS = {
    "apikey": KEY,
    "Authorization": "Bearer " + KEY,
    "Content-Type": "application/json",
}

# Columns to copy (must exist in schema.sql). We copy everything the pipeline
# stores; the id column is left to Postgres to generate.
COMPANY_COLS = ["name", "ats", "token", "first_seen", "last_seen"]
POSTING_COLS = [
    "company", "ats", "ats_job_id", "title", "role_family", "location", "city",
    "country", "remote", "salary_min", "salary_max", "currency", "salary_period",
    "salary_eur_min", "salary_eur_max", "salary_source", "posted_at", "url",
    "description", "first_seen", "last_seen", "expired_at", "status",
]


def rows_from_sqlite(table, cols):
    conn = sqlite3.connect(SQLITE_FILE)
    conn.row_factory = sqlite3.Row
    cur = conn.execute("SELECT {} FROM {}".format(", ".join(cols), table))
    out = []
    for r in cur.fetchall():
        d = {c: r[c] for c in cols}
        if "remote" in d and d["remote"] is not None:
            d["remote"] = bool(d["remote"])
        out.append(d)
    conn.close()
    return out


def upsert(table, rows, on_conflict):
    """Upsert rows in batches. Returns number sent."""
    url = "{}/{}?on_conflict={}".format(REST, table, on_conflict)
    headers = dict(HEADERS)
    headers["Prefer"] = "resolution=merge-duplicates,return=minimal"
    sent = 0
    for i in range(0, len(rows), BATCH):
        chunk = rows[i:i + BATCH]
        r = requests.post(url, headers=headers, data=json.dumps(chunk), timeout=60)
        if r.status_code >= 300:
            print("  ! batch {}-{} failed: {} {}".format(
                i, i + len(chunk), r.status_code, r.text[:300]))
            r.raise_for_status()
        sent += len(chunk)
        print("  ...{}/{} {}".format(sent, len(rows), table))
    return sent


def remote_count(table):
    """Exact row count via the Content-Range header."""
    headers = dict(HEADERS)
    headers["Prefer"] = "count=exact"
    headers["Range-Unit"] = "items"
    headers["Range"] = "0-0"
    r = requests.get("{}/{}?select=id".format(REST, table), headers=headers, timeout=30)
    cr = r.headers.get("content-range", "")
    return cr.split("/")[-1] if "/" in cr else "?"


def main():
    print("Migrating {} -> {}\n".format(SQLITE_FILE, URL))

    companies = rows_from_sqlite("companies", COMPANY_COLS)
    postings = rows_from_sqlite("job_postings", POSTING_COLS)
    print("Local: {} companies, {} job_postings\n".format(len(companies), len(postings)))

    print("Upserting companies...")
    upsert("companies", companies, "ats,token")
    print("Upserting job_postings...")
    upsert("job_postings", postings, "ats,ats_job_id")

    print("\nVerifying remote row counts:")
    rc_companies = remote_count("companies")
    rc_postings = remote_count("job_postings")
    print("  companies:    local {:>6}  |  supabase {:>6}".format(len(companies), rc_companies))
    print("  job_postings: local {:>6}  |  supabase {:>6}".format(len(postings), rc_postings))

    ok = str(rc_companies) == str(len(companies)) and str(rc_postings) == str(len(postings))
    print("\n{}".format("✅ Row counts match." if ok else
                        "⚠ Counts differ — check output above (may be pre-existing rows)."))


if __name__ == "__main__":
    main()
