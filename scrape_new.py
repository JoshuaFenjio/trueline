#!/usr/bin/env python3
# =============================================================================
# scrape_new.py — fetch jobs for the companies newly RESOLVED by sweep.py and
# upsert ONLY those into Supabase (merge on ats,ats_job_id — existing rows are
# never touched). Uses the pipeline's own fetchers + build_posting, so region /
# currency / period / role gates are identical to the main pipeline.
#
#   python3 scrape_new.py            # reads sweep_out.json, upserts new jobs
# =============================================================================
import datetime as dt
import json
import os

import requests

import pipeline as P

REST = os.environ["SUPABASE_URL"].rstrip("/") + "/rest/v1"
KEY = os.environ["SUPABASE_SERVICE_KEY"]
H = {"apikey": KEY, "Authorization": "Bearer " + KEY, "Content-Type": "application/json"}
NOW = dt.datetime.now(dt.timezone.utc).isoformat()

POSTING_COLS = ["company", "ats", "ats_job_id", "title", "role_family", "location", "city",
                "country", "remote", "salary_min", "salary_max", "currency", "salary_period",
                "salary_eur_min", "salary_eur_max", "salary_source", "posted_at", "url",
                "description", "first_seen", "last_seen", "expired_at", "status",
                "region", "multi_market"]

FETCH = {"greenhouse": P.fetch_greenhouse, "lever": P.fetch_lever, "ashby": P.fetch_ashby,
         "smartrecruiters": P.fetch_smartrecruiters, "recruitee": P.fetch_recruitee,
         "teamtailor": P.fetch_teamtailor}


def upsert(table, rows, on_conflict):
    url = "{}/{}?on_conflict={}".format(REST, table, on_conflict)
    hh = dict(H); hh["Prefer"] = "resolution=merge-duplicates,return=minimal"
    for i in range(0, len(rows), 100):
        r = requests.post(url, headers=hh, data=json.dumps(rows[i:i + 100]), timeout=90)
        if r.status_code >= 300:
            print("  upsert error {}: {}".format(r.status_code, r.text[:200]))
            return False
    return True


def main():
    resolved = json.load(open("sweep_out.json"))["resolved"]
    companies, all_posts = [], []
    total_ok = 0
    for c in resolved:
        name, ats, token = c["name"], c["ats"], c["token"]
        try:
            posts = FETCH[ats](name, token)
        except Exception as e:
            print("  {:<22} FETCH ERROR {}".format(name, e)); continue
        # keep only EMEA-region postings (mirror the pipeline's stored set)
        posts = [p for p in posts if p.get("region") == "EMEA"]
        for p in posts:
            p["first_seen"] = p["last_seen"] = NOW
            p["expired_at"] = None
            p["status"] = "active"
            all_posts.append({k: p.get(k) for k in POSTING_COLS})
        sal = sum(1 for p in posts if p.get("salary_source") not in (None, "none"))
        companies.append({"name": name, "ats": ats, "token": token,
                          "first_seen": NOW, "last_seen": NOW})
        print("  {:<22} {:<14} {:>4} EMEA jobs  ({} salaried)".format(name[:21], ats, len(posts), sal))
        total_ok += 1

    print("\nupserting {} companies, {} postings ...".format(len(companies), len(all_posts)))
    upsert("companies", companies, "ats,token")
    ok = upsert("job_postings", all_posts, "ats,ats_job_id")
    print("done." if ok else "FAILED on postings")
    print("companies scraped: {} | postings added: {}".format(total_ok, len(all_posts)))


if __name__ == "__main__":
    main()
