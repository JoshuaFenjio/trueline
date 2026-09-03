#!/usr/bin/env python3
# =============================================================================
# new_sources.py — additional permitted data sources, ToS-checked.
#
#   PERSONIO    public career XML feeds ({token}.jobs.personio.com/xml). Salary
#               is prose-only, parsed by the pipeline's (multilingual) parser.
#   LANDING.JOBS public API (landing.jobs/api/v1/jobs). Structured gross salary,
#               but the EMPLOYER IS ANONYMISED — stored under a sentinel company
#               and excluded from company boards; feeds role/country/city medians.
#   ADZUNA / REED  SCAFFOLD ONLY. Documented APIs that need keys; they read keys
#               from env and HARD-REJECT predicted-salary fields. No ingest until
#               keys exist (ADZUNA_APP_ID/ADZUNA_APP_KEY, REED_API_KEY).
#
# Deliberately NOT built (respecting their wishes):
#   JustJoin.it, NoFluffJobs  — robots.txt Disallow: /api/
#   SwissDevJobs              — public API returns "ENDPOINT Deprecated - contact us"
#
# Every row carries provenance in the `ats` column. All pipeline sanity gates
# (region/currency/period/ratio/suspect) apply via build_posting.
#
#   python3 new_sources.py personio --apply
#   python3 new_sources.py landing  --apply
#   python3 new_sources.py adzuna            # scaffold: reports "no key" unless set
# =============================================================================
import datetime as dt
import os
import re
import sys
import time
import xml.etree.ElementTree as ET

import requests

import pipeline as P

REST = os.environ["SUPABASE_URL"].rstrip("/") + "/rest/v1"
KEY = os.environ["SUPABASE_SERVICE_KEY"]
H = {"apikey": KEY, "Authorization": "Bearer " + KEY, "Content-Type": "application/json"}
NOW = dt.datetime.now(dt.timezone.utc).isoformat()
UA = {"User-Agent": "Mozilla/5.0 (SalaryRadar data collection; +https://trueline-azure.vercel.app)"}

POSTING_COLS = ["company", "ats", "ats_job_id", "title", "role_family", "location", "city",
                "country", "remote", "salary_min", "salary_max", "currency", "salary_period",
                "salary_eur_min", "salary_eur_max", "salary_source", "posted_at", "url",
                "description", "first_seen", "last_seen", "expired_at", "status",
                "region", "multi_market"]


def finalize(p):
    p["first_seen"] = p["last_seen"] = NOW
    p["expired_at"] = None
    p["status"] = "active"
    return {k: p.get(k) for k in POSTING_COLS}


def upsert(rows):
    if not rows:
        return 0
    # Dedupe by (ats, ats_job_id) — a source may repeat a job across pages, and
    # ON CONFLICT can't touch the same row twice in one command.
    seen, deduped = set(), []
    for r in rows:
        k = (r["ats"], r["ats_job_id"])
        if k in seen:
            continue
        seen.add(k); deduped.append(r)
    rows = deduped
    hh = dict(H, **{"Prefer": "resolution=merge-duplicates,return=minimal"})
    for i in range(0, len(rows), 100):
        r = requests.post(REST + "/job_postings?on_conflict=ats,ats_job_id", headers=hh,
                          json=rows[i:i+100], timeout=90)
        if r.status_code >= 300:
            print("  upsert error", r.status_code, r.text[:200]); return 0
    return len(rows)


# ---------------------------------------------------------------------------
# PERSONIO
# ---------------------------------------------------------------------------
def personio_fetch(token):
    """Return normalized postings for a Personio career feed, or None if the
    company isn't on Personio / has no feed."""
    url = "https://{}.jobs.personio.com/xml".format(token)
    for _ in range(3):
        try:
            r = requests.get(url, headers=UA, timeout=20, allow_redirects=True)
            if r.status_code == 429:
                time.sleep(3); continue
            if r.status_code != 200 or "<workzag-jobs" not in r.text:
                return None
            break
        except Exception:
            time.sleep(2)
    else:
        return None
    try:
        root = ET.fromstring(r.text)
    except ET.ParseError:
        return None
    out = []
    for pos in root.findall(".//position"):
        pid = (pos.findtext("id") or "").strip()
        title = (pos.findtext("name") or "").strip()
        office = (pos.findtext("office") or "").strip()
        # concatenate all description prose for the salary parser
        desc = " ".join(t.strip() for t in pos.itertext() if t and t.strip())
        if not pid or not title:
            continue
        out.append((pid, title, office, desc))
    return out


def run_personio(apply):
    from companies import COMPANIES
    tracked = {c["name"] for c in COMPANIES}
    # probe targets: watchlist + a bounded slice of untracked candidates
    names = []
    try:
        wl = open("web/lib/watchlist.ts").read()
        names += re.findall(r'name:\s*"([^"]+)"', wl)
    except FileNotFoundError:
        pass
    # candidate tokens from resolver's known-unresolved list, if present
    targets = []
    seen = set()
    for n in names:
        tok = re.sub(r"[^a-z0-9]", "", n.lower())
        if tok and tok not in seen:
            seen.add(tok); targets.append((n, tok))

    found, allposts = [], []
    for name, tok in targets:
        posts = personio_fetch(tok)
        time.sleep(1.0)  # Personio rate-limits; stay polite
        if not posts:
            continue
        emea = 0
        for pid, title, office, desc in posts:
            city = P.clean_city_raw(office) if hasattr(P, "clean_city_raw") else office
            row = P.build_posting("personio", name, pid, title, office, city or None,
                                  None, False, None, "https://{}.jobs.personio.com/".format(tok), desc)
            if row.get("region") != "EMEA":
                continue
            emea += 1
            allposts.append(finalize(row))
        sal = sum(1 for r in allposts if r["company"] == name and r["salary_source"] not in (None, "none"))
        found.append((name, tok, emea, sal))
        print("  {:<24} {:<18} {:>3} EMEA  ({} salaried)".format(name[:23], tok, emea, sal))

    print("\nPersonio: {} companies found, {} EMEA postings".format(len(found), len(allposts)))
    if apply:
        print("upserting...", upsert(allposts), "rows")


# ---------------------------------------------------------------------------
# LANDING.JOBS  (employer anonymised -> sentinel company, medians only)
# ---------------------------------------------------------------------------
LANDING_SENTINEL = "Landing.jobs (employer undisclosed)"


def run_landing(apply):
    allposts = []
    page = 1
    while page <= 20:
        r = requests.get("https://landing.jobs/api/v1/jobs", headers=UA,
                         params={"page": page}, timeout=30)
        if r.status_code != 200:
            break
        jobs = r.json()
        if not jobs:
            break
        for j in jobs:
            lo, hi = j.get("gross_salary_low"), j.get("gross_salary_high")
            if not (lo or hi):
                continue  # only ingest employer-posted salaries
            loc = (j.get("locations") or [{}])[0]
            row = P.build_posting(
                "landing_jobs", LANDING_SENTINEL, j["id"], j.get("title") or "",
                loc.get("city") or "", loc.get("city") or None,
                loc.get("country_code") or None, bool(j.get("remote")),
                j.get("published_at"), j.get("url") or None, j.get("role_description") or "",
                structured_salary={"min": lo, "max": hi, "currency": j.get("currency_code"), "period": "year"},
            )
            if row.get("region") == "EMEA":
                allposts.append(finalize(row))
        page += 1
        time.sleep(0.5)
    sal = sum(1 for r in allposts if r["salary_source"] not in (None, "none"))
    print("Landing.jobs: {} EMEA salaried postings (sentinel company, medians only)".format(len(allposts)))
    if apply:
        print("upserting...", upsert(allposts), "rows")


# ---------------------------------------------------------------------------
# GERMANTECHJOBS.DE  (public RSS; salary range MANDATORY in every item title,
# e.g. "Role @ Company [45.000 - 75.000 €]" — Germany, EUR, all usable). robots
# allows /rss. Salary is parsed from the title (the board's own posted range) and
# stored as 'structured' provenance under ats='germantechjobs'.
# ---------------------------------------------------------------------------
def run_germantechjobs(apply):
    r = requests.get("https://germantechjobs.de/rss", headers=UA, timeout=30)
    if r.status_code != 200:
        print("Germantechjobs: RSS HTTP", r.status_code); return
    try:
        root = ET.fromstring(r.content)
    except ET.ParseError:
        print("Germantechjobs: RSS parse error"); return
    allposts = []
    for it in root.findall(".//item"):
        title = (it.findtext("title") or "").strip()
        link = (it.findtext("link") or "").strip()
        desc = it.findtext("description") or ""
        if not title or not link:
            continue
        # "Role (m/w/d) @ Company [45.000 - 75.000 €]"
        role = title.split(" @ ")[0].strip() if " @ " in title else title.split("[")[0].strip()
        company = "Unknown"
        if " @ " in title:
            company = title.split(" @ ", 1)[1].split("[")[0].strip() or "Unknown"
        sal = P.parse_salary_from_text(title)  # the mandatory range lives in the title
        if not sal:
            continue  # no posted range -> skip (we never invent one)
        row = P.build_posting("germantechjobs", company, link, role, "Germany", None, "Germany",
                              False, it.findtext("pubDate"), link, desc,
                              structured_salary={"min": sal["min"], "max": sal["max"],
                                                 "currency": sal["currency"], "period": sal["period"]})
        if row.get("region") == "EMEA" and row["salary_source"] not in (None, "none"):
            allposts.append(finalize(row))
    sal_n = sum(1 for r in allposts if (r["currency"] or "") in ("EUR", "GBP", "CHF", "SEK", "DKK", "NOK", "PLN"))
    print("Germantechjobs: {} EMEA salaried postings ({} EMEA-currency usable)".format(len(allposts), sal_n))
    if apply:
        print("upserting...", upsert(allposts), "rows")


# ---------------------------------------------------------------------------
# HIMALAYAS  (public keyless JSON; structured minSalary/maxSalary/currency).
# Remote-global and USD-skewed, so we keep ONLY rows that are EMEA-region AND
# carry an EMEA currency (the rest can't feed EMEA medians). robots allows the
# /jobs/api endpoint (only paginated HTML ?page= URLs are disallowed).
# ---------------------------------------------------------------------------
def run_himalayas(apply):
    emea_cur = {"EUR", "GBP", "CHF", "SEK", "DKK", "NOK", "PLN"}
    allposts, offset = [], 0
    while offset < 2000:
        r = requests.get("https://himalayas.app/jobs/api", headers=UA,
                         params={"limit": 100, "offset": offset}, timeout=30)
        if r.status_code != 200:
            break
        jobs = r.json().get("jobs", [])
        if not jobs:
            break
        for j in jobs:
            if not j.get("minSalary") and not j.get("maxSalary"):
                continue
            loc = "; ".join(j.get("locationRestrictions") or [])
            if not loc:
                continue  # worldwide/unknown -> can't claim as EMEA
            row = P.build_posting("himalayas", j.get("companyName") or "Unknown",
                                  j.get("guid") or j.get("applicationLink"), j.get("title") or "",
                                  loc, None, None, True, j.get("pubDate"), j.get("applicationLink"),
                                  j.get("description") or "",
                                  structured_salary={"min": j.get("minSalary"), "max": j.get("maxSalary"),
                                                     "currency": j.get("currency"), "period": j.get("salaryPeriod")})
            # keep only EMEA-region rows with an EMEA currency (median-usable)
            if row.get("region") == "EMEA" and (row["currency"] or "") in emea_cur \
               and row["salary_source"] not in (None, "none"):
                allposts.append(finalize(row))
        offset += len(jobs)
        time.sleep(0.5)
    print("Himalayas: {} EMEA-currency salaried postings kept".format(len(allposts)))
    if apply:
        print("upserting...", upsert(allposts), "rows")


# ---------------------------------------------------------------------------
# ITJOBS.PT — SCAFFOLD. Official documented REST API with explicit salaryMin/
# salaryMax (annual gross); robots-clean, but needs a free read-only api key
# (self-serve by email -> ITJOBS_API_KEY). Respects its ai-train=no signal:
# we ingest for reference/benchmarking, never for model training.
# ---------------------------------------------------------------------------
def run_itjobs(apply):
    key = os.environ.get("ITJOBS_API_KEY")
    if not key:
        print("ITJobs.pt: SCAFFOLD READY — set ITJOBS_API_KEY (free at api.itjobs.pt) to activate.")
        print("  Will ingest documented salaryMin/salaryMax (annual gross EUR); PT rows; ai-train=no honored.")
        return
    allposts, page = [], 1
    while page <= 50:
        r = requests.get("https://api.itjobs.pt/job/list.json", headers=UA,
                         params={"api_key": key, "page": page, "limit": 100}, timeout=30)
        if r.status_code != 200:
            break
        jobs = (r.json() or {}).get("results", [])
        if not jobs:
            break
        for j in jobs:
            lo, hi = j.get("wage") or j.get("salaryMin"), j.get("salaryMax")
            if not (lo or hi):
                continue
            loc = (j.get("locations") or [{}])
            city = (loc[0].get("name") if loc else None)
            row = P.build_posting("itjobs", (j.get("company") or {}).get("name") or "Unknown",
                                  j["id"], j.get("title") or "", city or "Portugal", city, "Portugal",
                                  bool(j.get("allowRemote")), j.get("publishedAt"),
                                  (j.get("company") or {}).get("url"), j.get("body") or "",
                                  structured_salary={"min": lo, "max": hi, "currency": "EUR", "period": "year"})
            if row.get("region") == "EMEA":
                allposts.append(finalize(row))
        page += 1
        time.sleep(0.5)
    print("ITJobs.pt: {} PT salaried postings".format(len(allposts)))
    if apply:
        print("upserting...", upsert(allposts), "rows")


# ---------------------------------------------------------------------------
# ADZUNA / REED — scaffold only (need keys; predicted salaries hard-rejected)
# ---------------------------------------------------------------------------
def run_adzuna(apply):
    app_id, app_key = os.environ.get("ADZUNA_APP_ID"), os.environ.get("ADZUNA_APP_KEY")
    if not (app_id and app_key):
        print("Adzuna: SCAFFOLD READY — set ADZUNA_APP_ID + ADZUNA_APP_KEY to activate.")
        print("  Will ingest ONLY salary_is_predicted==0 rows; dedupe by company+title+location.")
        return
    # Live path (activates once keys exist).
    allposts = []
    for cc in ["gb", "de", "fr", "nl", "es", "it", "pl", "at", "ch", "ie", "se", "dk"]:
        r = requests.get("https://api.adzuna.com/v1/api/jobs/{}/search/1".format(cc),
                         params={"app_id": app_id, "app_key": app_key, "results_per_page": 50,
                                 "what": "engineer"}, timeout=30)
        if r.status_code != 200:
            continue
        for j in r.json().get("results", []):
            if j.get("salary_is_predicted") in (1, "1"):   # HARD REJECT predicted
                continue
            lo, hi = j.get("salary_min"), j.get("salary_max")
            if not (lo or hi):
                continue
            row = P.build_posting("adzuna", (j.get("company") or {}).get("display_name") or "Unknown",
                                  j["id"], j.get("title") or "", (j.get("location") or {}).get("display_name") or "",
                                  None, None, False, j.get("created"), j.get("redirect_url"), j.get("description") or "",
                                  structured_salary={"min": lo, "max": hi, "currency": "EUR" if cc != "gb" else "GBP", "period": "year"})
            if row.get("region") == "EMEA":
                allposts.append(finalize(row))
        time.sleep(0.5)
    print("Adzuna: {} employer-posted (non-predicted) rows".format(len(allposts)))
    if apply:
        print("upserting...", upsert(allposts), "rows")


def run_reed(apply):
    api_key = os.environ.get("REED_API_KEY")
    if not api_key:
        print("Reed: SCAFFOLD READY — set REED_API_KEY to activate.")
        print("  Reed returns employer-posted min/max only (no predicted field); dedupe by company+title+location.")
        return
    allposts = []
    r = requests.get("https://www.reed.co.uk/api/1.0/search", auth=(api_key, ""),
                     params={"resultsToTake": 100, "keywords": "engineer"}, timeout=30)
    if r.status_code == 200:
        for j in r.json().get("results", []):
            lo, hi = j.get("minimumSalary"), j.get("maximumSalary")
            if not (lo or hi):
                continue
            row = P.build_posting("reed", j.get("employerName") or "Unknown", j["jobId"],
                                  j.get("jobTitle") or "", j.get("locationName") or "", j.get("locationName") or None,
                                  "United Kingdom", False, j.get("date"), j.get("jobUrl"), j.get("jobDescription") or "",
                                  structured_salary={"min": lo, "max": hi, "currency": "GBP", "period": "year"})
            if row.get("region") == "EMEA":
                allposts.append(finalize(row))
    print("Reed: {} employer-posted rows".format(len(allposts)))
    if apply:
        print("upserting...", upsert(allposts), "rows")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    apply = "--apply" in sys.argv
    {"personio": run_personio, "landing": run_landing,
     "germantechjobs": run_germantechjobs, "himalayas": run_himalayas, "itjobs": run_itjobs,
     "adzuna": run_adzuna, "reed": run_reed}.get(
        cmd, lambda a: print("usage: personio|landing|germantechjobs|himalayas|itjobs|adzuna|reed [--apply]"))(apply)
