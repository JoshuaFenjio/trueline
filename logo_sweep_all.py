#!/usr/bin/env python3
# =============================================================================
# logo_sweep_all.py — resolve a logo domain for EVERY scraped company, not just
# the top 100. Extends the chain logo_audit.py established, with the same
# safety rule, over the full active-company set.
#
#   python3 logo_sweep_all.py            # probe + write resolved.json + report
#   python3 logo_sweep_all.py --emit     # also print a companyMeta.ts block
#
# SAFETY — a domain is accepted on one of two evidence paths, never on a guess:
#
#   A. OWN-DOMAIN EVIDENCE (strongest). One of the company's own job-posting
#      URLs is hosted on the domain (careers.capgemini.com -> capgemini.com).
#      That is the employer publishing from its own domain; nothing to infer.
#
#   B. NAME + IDENTITY MATCH. The domain's second-level label equals the
#      company's normalised name AND its homepage <title>/og:site_name contains
#      that name. Because a label match alone is NOT proof — moss.com, finn.com
#      and applied.com are all real businesses that are not the employers we
#      track — path B additionally requires the normalised name to be >= 7
#      characters and not a generic English word. Short and generic names can
#      only ever resolve via path A.
#
# Both paths then require DuckDuckGo to serve a real icon for the domain (the
# same signal CompanyLogo relies on at render time), so an accepted domain is
# one that will actually show a logo rather than a broken image.
#
# Anything that fails stays a letter-mark. A wrong logo is a factual error on
# the page, so the bias is always towards the letter-mark.
#
# Needs SUPABASE_URL + SUPABASE_SERVICE_KEY (or _ANON_KEY) in the environment.
# =============================================================================
import concurrent.futures as cf
import json
import os
import re
import sys
import time
from collections import Counter

import requests

REST = os.environ["SUPABASE_URL"].rstrip("/") + "/rest/v1/job_postings"
KEY = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ["SUPABASE_ANON_KEY"]
H = {"apikey": KEY, "Authorization": "Bearer " + KEY}

# Ordered by how often each TLD wins for EMEA employers, so the common case
# costs one probe.
TLDS = [
    "com", "io", "ai", "de", "co.uk", "fr", "nl", "es", "it", "eu", "co",
    "app", "dev", "tech", "se", "fi", "dk", "no", "pl", "ch", "at", "be",
    "pt", "ie", "cz", "ro", "gr", "hu", "tr", "ae", "co.za", "com.tr",
]

# Corporate suffixes and noise that are not part of the domain label.
SUFFIX_RE = re.compile(
    r"\b(gmbh|mbh|ag|se|kg|ohg|ug|e\.?v|co\.?\s*kg|holding|group|gruppe|"
    r"ltd|limited|plc|llp|llc|inc|corp|corporation|company|bv|b\.v|nv|n\.v|"
    r"sa|s\.a|sas|sarl|srl|spa|s\.p\.a|oy|oyj|ab|a\/s|as|aps|sp\.?\s*z\s*o\.?o|"
    r"zoo|doo|d\.o\.o|kft|s\.r\.o|sro|international|deutschland|germany|"
    r"france|espana|italia|nederland|uk|europe|emea)\b",
    re.I,
)


def norm(s, strip_suffix=True):
    s = (s or "").lower()
    s = s.replace("&", " and ")
    if strip_suffix:
        s = SUFFIX_RE.sub(" ", s)
    return re.sub(r"[^a-z0-9]", "", s)


def label_of(domain):
    """Second-level label: 'foo.co.uk' -> 'foo', 'foo.com' -> 'foo'."""
    parts = domain.split(".")
    if len(parts) >= 3 and parts[-2] in ("co", "com", "org", "net", "gov", "ac"):
        return parts[-3]
    return parts[-2] if len(parts) >= 2 else parts[0]


def load_meta_domains():
    src = open("web/lib/companyMeta.ts").read()
    out = {}
    for m in re.finditer(r'(?:"([^"]+)"|([A-Za-z][\w.&+\- ]*?))\s*:\s*\{[^}]*?website:\s*"([^"]+)"', src):
        out[(m.group(1) or m.group(2)).strip()] = m.group(3)
    return out


def companies():
    out, off = [], 0
    while True:
        b = []
        for _ in range(4):
            try:
                r = requests.get(REST, headers=dict(H, **{"Range-Unit": "items", "Range": f"{off}-{off+999}"}),
                                 params={"status": "eq.active", "order": "id.asc", "select": "company"}, timeout=60)
                b = r.json()
                break
            except Exception:
                time.sleep(2)
        if not isinstance(b, list) or not b:
            break
        out += b
        if len(b) < 1000:
            break
        off += 1000
    return Counter(x["company"] for x in out if x.get("company"))


SESSION = requests.Session()
SESSION.headers["User-Agent"] = "SalaryRadar-logo-audit/1.0 (+https://salaryradar.eu)"

# Hosts that belong to an ATS, a job board or an aggregator — a posting living
# there says nothing about the employer's own domain.
ATS_SUFFIXES = (
    "greenhouse.io", "lever.co", "ashbyhq.com", "smartrecruiters.com", "recruitee.com",
    "teamtailor.com", "workable.com", "personio.de", "personio.com", "join.com",
    "softgarden.io", "softgarden.de", "jobvite.com", "workday.com", "myworkdayjobs.com",
    "successfactors.com", "taleo.net", "icims.com", "bamboohr.com", "breezy.hr",
    "pinpointhq.com", "jazzhr.com", "applytojob.com", "withgoogle.com", "comeet.com",
    "factorialhr.com", "kenjo.io", "talentlyft.com", "zohorecruit.com", "homerun.co",
    "heyjobs.co", "jobteaser.com", "dvinci.de", "d-vinci.de", "concludis.de",
    "b-ite.com", "rexx-systems.com", "guidecom.de", "prescreen.io", "umantis.com",
    "haufe.com", "jobbase.io", "firststage.co", "careers-page.com", "hrmdirect.com",
    "germantechjobs.de", "himalayas.app", "welcometothejungle.com", "landing.jobs",
    "otta.com", "wellfound.com", "linkedin.com", "indeed.com", "glassdoor.com",
    "stepstone.de", "xing.com", "eurotechjobs.com", "jobs.eu", "hibob.com",
    "recruitcrm.io", "workwithus.io", "talentsoft.com", "flatchr.io", "teamtailor.se",
)

# 2-level public suffixes we see in EMEA, so "foo.co.uk" resolves to "foo.co.uk"
# rather than "co.uk".
TWO_LEVEL = {
    "co.uk", "org.uk", "ac.uk", "gov.uk", "com.tr", "com.br", "co.za", "co.il",
    "com.au", "co.nz", "com.mx", "co.jp", "com.pl", "com.es", "com.pt", "com.ua",
    "com.cy", "com.mt", "com.gr", "co.at", "or.at", "com.hr", "com.ro",
}

# Generic English words that are also real unrelated businesses. A company whose
# whole name is one of these can only resolve via own-domain evidence.
GENERIC = {
    "applied", "remote", "moss", "finn", "oyster", "headway", "symphony", "nested",
    "element", "spark", "signal", "orbit", "vector", "summit", "atlas", "bolt",
    "current", "future", "global", "modern", "native", "origin", "pioneer", "prime",
    "pulse", "rapid", "scale", "shield", "simple", "smart", "source", "sphere",
    "stack", "stream", "swift", "trust", "unity", "vantage", "venture", "vision",
    "zenith", "anchor", "beacon", "bridge", "canvas", "cascade", "compass", "forge",
    "harbor", "harbour", "haven", "helix", "horizon", "impact", "insight", "kernel",
    "lattice", "lever", "linear", "matrix", "meridian", "momentum", "nexus", "nova",
    "onward", "optimal", "paragon", "pivot", "quantum", "radiant", "relay", "render",
    "sentinel", "sequoia", "solstice", "sonder", "spectrum", "strive", "tempo",
    "tandem", "tessera", "thrive", "titan", "torus", "vertex", "vista", "zephyr",
    "studio", "agency", "school", "academy", "clinic", "hospital", "council",
    "university", "college", "institute", "foundation", "partners", "capital",
}


def registrable(host):
    """foo.bar.co.uk -> bar.co.uk ; careers.capgemini.com -> capgemini.com"""
    host = (host or "").lower().strip(".")
    parts = host.split(".")
    if len(parts) < 2:
        return ""
    if len(parts) >= 3 and ".".join(parts[-2:]) in TWO_LEVEL:
        return ".".join(parts[-3:])
    return ".".join(parts[-2:])


def own_domains():
    """company -> registrable domain, from the company's OWN posting URLs."""
    import urllib.parse
    out, off = {}, 0
    tally = {}
    while True:
        b = []
        for _ in range(4):
            try:
                r = requests.get(REST, headers=dict(H, **{"Range-Unit": "items", "Range": f"{off}-{off+999}"}),
                                 params={"status": "eq.active", "order": "id.asc", "select": "company,url"}, timeout=60)
                b = r.json()
                break
            except Exception:
                time.sleep(2)
        if not isinstance(b, list) or not b:
            break
        for row in b:
            co, u = row.get("company"), row.get("url") or ""
            if not co or not u:
                continue
            host = ""
            try:
                host = (urllib.parse.urlparse(u).hostname or "").lower()
            except Exception:
                pass
            if not host or any(host == s or host.endswith("." + s) for s in ATS_SUFFIXES):
                continue
            d = registrable(host)
            if not d:
                continue
            tally.setdefault(co, Counter())[d] += 1
        if len(b) < 1000:
            break
        off += 1000
    for co, c in tally.items():
        out[co] = c.most_common(1)[0][0]
    return out


def homepage_identity(domain):
    """Lowercased <title> + og:site_name of the domain's homepage, or ''."""
    # Some hosts only answer on the www. alias, some only over http.
    for host in (domain, "www." + domain):
        for scheme in ("https", "http"):
            t = _fetch_identity(f"{scheme}://{host}/")
            if t:
                return t
    return ""


def _fetch_identity(url):
    for attempt in (0, 1):
        try:
            r = SESSION.get(url, timeout=15, allow_redirects=True)
        except Exception:
            time.sleep(0.5)
            continue
        if r.status_code >= 400:
            return ""
        html = r.text[:200_000]
        t = " ".join(re.findall(r"<title[^>]*>(.*?)</title>", html, re.I | re.S)[:1])
        og = " ".join(re.findall(r'<meta[^>]+property=["\']og:site_name["\'][^>]+content=["\']([^"\']+)', html, re.I)[:1])
        desc = " ".join(re.findall(r'<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']+)', html, re.I)[:1])
        return re.sub(r"\s+", " ", (t + " " + og + " " + desc)).lower()
    return ""


def ddg_ok(domain):
    """True when DuckDuckGo serves a real icon for this domain."""
    try:
        r = SESSION.get(f"https://icons.duckduckgo.com/ip3/{domain}.ico", timeout=8)
    except Exception:
        return False
    # DDG answers 200 with a tiny 1x1/placeholder when it has nothing.
    return r.status_code == 200 and len(r.content) > 400


def name_candidate(name):
    """First label-matching domain that DDG serves an icon for, or None."""
    for n in [norm(name), norm(name, strip_suffix=False)]:
        if len(n) < 3:
            continue
        for tld in TLDS:
            d = f"{n}.{tld}"
            if label_of(d) != n:
                continue
            if ddg_ok(d):
                return n, d
    return None, None


def resolve(name, own):
    """(domain, evidence) or (None, reason). See the SAFETY note at the top."""
    # Path A — the employer publishes jobs from this domain.
    d = own.get(name)
    if d and ddg_ok(d):
        return d, "own-domain"
    n, cand = name_candidate(name)
    if not cand:
        return None, "no-candidate"
    # Path B — label match plus a homepage that names the company. Short and
    # generic names are excluded from this path entirely; they resolve via A or
    # not at all.
    # 5+ characters: distinctive coined names (Sysdig, Bynder, Encord) are safe
    # to confirm from their own homepage; dictionary words are not, whatever
    # their length, which is what GENERIC is for.
    if len(n) < 5 or n in GENERIC:
        return None, "ambiguous-name"
    ident = homepage_identity(cand)
    if not ident:
        return None, "no-homepage"
    if n not in re.sub(r"[^a-z0-9]", "", ident):
        return None, "identity-mismatch"
    return cand, "name+identity"


def main():
    counts = companies()
    have = load_meta_domains()
    print("collecting own-domain evidence from posting URLs...")
    own = own_domains()
    print(f"  {len(own)} companies publish from a non-ATS domain")
    missing = [c for c in counts if c not in have]
    missing.sort(key=lambda c: -counts[c])
    print(f"active companies: {len(counts)}   with a domain: {len(counts) - len(missing)}   missing: {len(missing)}")

    resolved = {}
    evidence, rejected = {}, {}
    t0 = time.time()
    with cf.ThreadPoolExecutor(max_workers=16) as ex:
        futs = {ex.submit(resolve, c, own): c for c in missing}
        done = 0
        for f in cf.as_completed(futs):
            c = futs[f]
            done += 1
            try:
                d, why = f.result()
            except Exception:
                d, why = None, "error"
            if d:
                resolved[c] = d
                evidence[why] = evidence.get(why, 0) + 1
            else:
                rejected[why] = rejected.get(why, 0) + 1
            if done % 200 == 0:
                print(f"  {done}/{len(missing)} probed, {len(resolved)} resolved ({time.time()-t0:.0f}s)", flush=True)

    json.dump(resolved, open("logo_resolved.json", "w"), indent=1, ensure_ascii=False, sort_keys=True)
    print("\naccepted by evidence:", evidence)
    print("rejected by reason  :", rejected)

    total_co = len(counts)
    total_ads = sum(counts.values())
    after_co = (total_co - len(missing)) + len(resolved)
    after_ads = sum(v for k, v in counts.items() if k in have or k in resolved)
    before_ads = sum(v for k, v in counts.items() if k in have)
    print("")
    print("COVERAGE")
    print(f"  companies : {total_co - len(missing)}/{total_co} ({(total_co-len(missing))/total_co*100:.1f}%)"
          f"  ->  {after_co}/{total_co} ({after_co/total_co*100:.1f}%)")
    print(f"  job ads   : {before_ads}/{total_ads} ({before_ads/total_ads*100:.1f}%)"
          f"  ->  {after_ads}/{total_ads} ({after_ads/total_ads*100:.1f}%)")
    still = [c for c in missing if c not in resolved]
    print(f"\nstill letter-marks: {len(still)} companies, {sum(counts[c] for c in still)} job ads")
    print("largest remaining letter-marks:")
    for c in sorted(still, key=lambda c: -counts[c])[:40]:
        print(f"  {counts[c]:>4}  {c}")
    json.dump({c: counts[c] for c in sorted(still, key=lambda c: -counts[c])},
              open("logo_lettermarks.json", "w"), indent=1, ensure_ascii=False)

    if "--emit" in sys.argv:
        print("\n// --- paste into web/lib/companyMeta.ts ---")
        for c in sorted(resolved):
            key = c if re.fullmatch(r"[A-Za-z][A-Za-z0-9]*", c) else json.dumps(c, ensure_ascii=False)
            print(f'  {key}: {{ website: "{resolved[c]}" }},')


if __name__ == "__main__":
    main()
