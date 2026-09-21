#!/usr/bin/env python3
# =============================================================================
# jsonld.py — JSON-LD JobPosting harvester. PHASE 1: yield test only.
#
# schema.org JobPosting markup is machine-readable by design, but robots.txt
# governs absolutely: every fetch is robots-checked FIRST with our real UA. No
# UA games, no exceptions — a disallowed path is skipped and logged.
#
#   python3 jsonld.py <careers_url>     # dump JobPostings found at one URL
#   python3 jsonld.py --test            # run the Phase-1 yield test + report
#
# Phase 1 does NOT ingest. It measures whether JSON-LD disclosure is worth
# scaling. No wiring into the scheduled runs without an explicit go.
# =============================================================================
import json
import re
import sys
import time
import urllib.parse
import urllib.robotparser
from html import unescape

import requests

import pipeline as P

UA = "Mozilla/5.0 (SalaryRadar data collection; +https://trueline-azure.vercel.app)"
HDRS = {"User-Agent": UA}
PAGE_CAP = 50            # max fetches per site (ItemList detail pages + pagination)
TIMEOUT = 20
_ROBOTS = {}             # host -> RobotFileParser | None (None = unreachable)

CAREERS_PATHS = ["/careers", "/careers/", "/jobs", "/en/careers", "/careers/jobs",
                 "/company/careers", "/about/careers", "/join-us", "/work-with-us",
                 "/en/jobs", "/company/jobs"]
UNIT_PERIOD = {"HOUR": "hour", "DAY": "day", "WEEK": "week", "MONTH": "month", "YEAR": "year"}


# --- robots.txt: governs absolutely ------------------------------------------
def _robots_for(host_url):
    parts = urllib.parse.urlsplit(host_url)
    base = "{}://{}".format(parts.scheme, parts.netloc)
    if base in _ROBOTS:
        return _ROBOTS[base]
    rp = urllib.robotparser.RobotFileParser()
    try:
        r = requests.get(base + "/robots.txt", headers=HDRS, timeout=TIMEOUT)
        if r.status_code == 200:
            rp.parse(r.text.splitlines())
        elif r.status_code in (401, 403):
            rp = None  # access to robots itself is refused -> treat as disallowed
        else:
            rp.parse([])  # 404/no robots -> nothing disallowed
    except requests.exceptions.RequestException:
        rp = None  # unreachable -> we can't confirm permission -> skip
    _ROBOTS[base] = rp
    return rp


def robots_ok(url):
    """True only if robots.txt explicitly allows our UA. Unreachable/blocked
    robots -> False (we never fetch what we can't confirm is permitted)."""
    rp = _robots_for(url)
    if rp is None:
        return False
    return rp.can_fetch(UA, url)


# --- JSON-LD extraction -------------------------------------------------------
_SCRIPT_RE = re.compile(r'<script[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
                        re.I | re.S)


def _loads(block):
    try:
        return json.loads(block)
    except json.JSONDecodeError:
        try:
            return json.loads(unescape(block))
        except json.JSONDecodeError:
            return None


def _iter_objects(data):
    """Yield every dict in a JSON-LD payload (handles arrays and @graph)."""
    stack = [data]
    while stack:
        x = stack.pop()
        if isinstance(x, list):
            stack.extend(x)
        elif isinstance(x, dict):
            yield x
            if "@graph" in x:
                stack.append(x["@graph"])


def _is_type(obj, t):
    v = obj.get("@type")
    return v == t or (isinstance(v, list) and t in v)


def _text(v):
    if isinstance(v, dict):
        return v.get("name") or v.get("@value") or ""
    if isinstance(v, list) and v:
        return _text(v[0])
    return v or ""


def _location(jp):
    loc = jp.get("jobLocation")
    if isinstance(loc, list):
        loc = loc[0] if loc else None
    if not isinstance(loc, dict):
        return None, None
    addr = loc.get("address") or {}
    if isinstance(addr, list):
        addr = addr[0] if addr else {}
    if not isinstance(addr, dict):
        return None, None
    city = addr.get("addressLocality")
    country = addr.get("addressRegion") or addr.get("addressCountry")
    country = _text(country) if country else None
    return (city or None), (country or None)


def _salary(jp):
    bs = jp.get("baseSalary")
    if isinstance(bs, list):
        bs = bs[0] if bs else None
    if not isinstance(bs, dict):
        return None
    cur = bs.get("currency") or bs.get("priceCurrency")
    val = bs.get("value")
    lo = hi = None
    unit = None
    if isinstance(val, dict):
        lo = val.get("minValue")
        hi = val.get("maxValue")
        single = val.get("value")
        if lo is None and hi is None and single is not None:
            lo = hi = single
        unit = val.get("unitText")
        cur = cur or val.get("currency")
    elif isinstance(val, (int, float, str)):
        lo = hi = val
    if lo is None and hi is None:
        return None
    def num(x):
        try:
            return float(str(x).replace(",", ""))
        except (TypeError, ValueError):
            return None
    lo, hi = num(lo), num(hi)
    if lo is None and hi is None:
        return None
    return {"min": lo or hi, "max": hi or lo,
            "currency": (cur or "").upper() or None,
            "period": UNIT_PERIOD.get((unit or "").upper(), "year")}


def _norm_title(t):
    return re.sub(r"\s+", " ", (t or "").lower()).strip()


def fetch_jsonld(careers_url, company=None, cap=PAGE_CAP, verbose=False):
    """Harvest JobPosting JSON-LD from a careers URL. robots-checked first.
    Follows @graph and ItemList-linked same-domain detail pages (robots-permitted,
    capped). Returns (postings, stats). Phase 1: parses + gates, does NOT ingest."""
    stats = {"attempted": 1, "robots_blocked": 0, "fetched": 0,
             "pages_with_markup": 0, "postings": 0, "with_salary": 0, "passing": 0}
    host = urllib.parse.urlsplit(careers_url).netloc
    seen_urls, to_visit, out = set(), [careers_url], []
    seen_keys = set()

    while to_visit and len(seen_urls) < cap:
        url = to_visit.pop(0)
        if url in seen_urls:
            continue
        seen_urls.add(url)
        if not robots_ok(url):
            stats["robots_blocked"] += 1
            if verbose:
                print("  robots-blocked:", url)
            continue
        try:
            r = requests.get(url, headers=HDRS, timeout=TIMEOUT)
        except requests.exceptions.RequestException:
            continue
        if r.status_code != 200 or "html" not in r.headers.get("content-type", "").lower():
            continue
        stats["fetched"] += 1
        blocks = _SCRIPT_RE.findall(r.text)
        page_had = False
        for block in blocks:
            data = _loads(block)
            if data is None:
                continue
            for obj in _iter_objects(data):
                # ItemList -> queue same-domain detail pages (robots checked on fetch)
                if _is_type(obj, "ItemList"):
                    for el in (obj.get("itemListElement") or []):
                        u = None
                        if isinstance(el, dict):
                            u = el.get("url") or (el.get("item") or {}).get("url") if isinstance(el.get("item"), dict) else el.get("url")
                        if u and urllib.parse.urlsplit(u).netloc in ("", host) and len(seen_urls) + len(to_visit) < cap:
                            to_visit.append(urllib.parse.urljoin(url, u))
                if not _is_type(obj, "JobPosting"):
                    continue
                page_had = True
                stats["postings"] += 1
                title = _text(obj.get("title"))
                city, country = _location(obj)
                sal = _salary(obj)
                if sal:
                    stats["with_salary"] += 1
                org = _text(obj.get("hiringOrganization")) or company or host
                loc_str = ", ".join([p for p in (city, country) if p]) or None
                post = P.build_posting("jsonld", company or org, obj.get("identifier") or url,
                                       title, loc_str, city, country, False,
                                       obj.get("datePosted"), obj.get("url") or url, "",
                                       structured_salary=sal)
                key = (post["company"], _norm_title(title), (city or "").lower())
                if key in seen_keys:
                    continue
                seen_keys.add(key)
                # passing = median-eligible: EMEA region + EMEA currency + plausible base
                usable = (post["salary_source"] not in (None, "none", "parsed_suspect")
                          and post.get("salary_eur_min") and post.get("region") == "EMEA")
                if usable:
                    stats["passing"] += 1
                out.append((post, bool(sal), usable))
        if page_had:
            stats["pages_with_markup"] += 1
        time.sleep(0.5)
    return out, stats


# --- Phase-1 test harness -----------------------------------------------------
def _watchlist_domains():
    out = []
    try:
        wl = open("web/lib/watchlist.ts").read()
        for m in re.finditer(r'name:\s*"([^"]+)".*?domain:\s*"([^"]+)"', wl):
            out.append((m.group(1), m.group(2)))
    except FileNotFoundError:
        pass
    return out


def _backlog_domains():
    """Unresolved-backlog companies (companies.py) that have a website in
    companyMeta.ts. These are famous cos our ATS fetchers never resolved."""
    names = []
    try:
        cp = open("companies.py").read()
        blk = cp.split("Unresolved (no ATS returned jobs)")[-1]
        names = re.findall(r'"name":\s*\'([^\']+)\'', blk)
    except (FileNotFoundError, IndexError):
        pass
    meta = ""
    try:
        meta = open("web/lib/companyMeta.ts").read()
    except FileNotFoundError:
        pass
    out = []
    for n in names:
        m = re.search(r'(?:"' + re.escape(n) + r'"|' + re.escape(n) + r'):\s*\{[^}]*website:\s*"([^"]+)"', meta)
        if m:
            out.append((n, m.group(1)))
    return out


def _ats_covered():
    """Companies already covered by an ATS fetcher — never harvest these."""
    import os
    url = os.environ["SUPABASE_URL"].rstrip("/") + "/rest/v1/job_postings"
    key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ["SUPABASE_KEY"]
    h = {"apikey": key, "Authorization": "Bearer " + key}
    ats = ["greenhouse", "lever", "ashby", "smartrecruiters", "recruitee", "teamtailor"]
    covered = set()
    off = 0
    while True:
        r = requests.get(url, headers=dict(h, **{"Range": "{}-{}".format(off, off + 999)}),
                         params={"ats": "in.({})".format(",".join(ats)), "order": "id.asc",
                                 "select": "company"}, timeout=60)
        b = r.json()
        if not b:
            break
        covered.update((x.get("company") or "").strip() for x in b)
        if len(b) < 1000:
            break
        off += 1000
    return covered


def _find_careers(domain):
    """Probe common careers paths; return the first robots-permitted 200 HTML URL
    that actually carries JobPosting markup, else None."""
    for scheme in ("https://",):
        for path in CAREERS_PATHS:
            url = scheme + domain + path
            if not robots_ok(url):
                continue
            try:
                r = requests.get(url, headers=HDRS, timeout=TIMEOUT)
            except requests.exceptions.RequestException:
                continue
            if r.status_code == 200 and "html" in r.headers.get("content-type", "").lower():
                if '"JobPosting"' in r.text or "'JobPosting'" in r.text or "application/ld+json" in r.text:
                    return url
    return None


def run_test():
    covered = _ats_covered()
    print("ATS-covered companies (excluded):", len(covered))
    targets = [("watchlist", n, d) for n, d in _watchlist_domains()]
    targets += [("backlog", n, d) for n, d in _backlog_domains()]
    # de-dupe by name; drop any already covered by an ATS fetcher
    seen, clean = set(), []
    for src, n, d in targets:
        if n in seen or n in covered:
            continue
        seen.add(n); clean.append((src, n, d))
    print("test companies:", len(clean), "(watchlist + backlog with a website, not ATS-covered)")

    agg = {"companies": len(clean), "careers_found": 0, "attempted": 0, "robots_blocked": 0,
           "fetched": 0, "pages_with_markup": 0, "postings": 0, "with_salary": 0, "passing": 0}
    hits = []
    for i, (src, name, domain) in enumerate(clean, 1):
        careers = _find_careers(domain)
        if not careers:
            print("[{:>3}/{}] {:<24} no robots-permitted careers page w/ markup".format(i, len(clean), name[:24]))
            agg["attempted"] += 1
            continue
        agg["careers_found"] += 1
        posts, st = fetch_jsonld(careers, company=name)
        for k in ("attempted", "robots_blocked", "fetched", "pages_with_markup", "postings", "with_salary", "passing"):
            agg[k] += st[k]
        if st["postings"]:
            hits.append((name, st["postings"], st["with_salary"], st["passing"]))
        print("[{:>3}/{}] {:<24} {:<40} postings={} salary={} pass={}".format(
            i, len(clean), name[:24], careers[:40], st["postings"], st["with_salary"], st["passing"]))
        time.sleep(0.3)

    print("\n" + "=" * 64)
    print("JSON-LD PHASE-1 YIELD TEST")
    print("=" * 64)
    for k in ("companies", "careers_found", "attempted", "robots_blocked", "fetched",
              "pages_with_markup", "postings", "with_salary", "passing"):
        print("  {:<22} {}".format(k, agg[k]))
    jsonld_disc = (agg["with_salary"] / agg["postings"] * 100) if agg["postings"] else 0
    print("\n  JSON-LD salary-disclosure %: {:.1f}%  ({}/{})".format(
        jsonld_disc, agg["with_salary"], agg["postings"]))
    if hits:
        print("\n  companies with JobPosting markup:")
        for n, p, s, g in sorted(hits, key=lambda x: -x[1]):
            print("    {:<24} postings={:<4} salary={:<4} pass={}".format(n[:24], p, s, g))
    return agg, jsonld_disc


if __name__ == "__main__":
    if "--test" in sys.argv:
        run_test()
    elif len(sys.argv) > 1 and sys.argv[1].startswith("http"):
        posts, st = fetch_jsonld(sys.argv[1], verbose=True)
        print(json.dumps(st, indent=2))
        for post, has_sal, usable in posts[:20]:
            print("  {:<40} {:<18} {} {}".format(
                (post["title"] or "")[:40], post["role_family"],
                post.get("salary_eur_min"), "PASS" if usable else ""))
    else:
        print("usage: jsonld.py <careers_url> | --test")
