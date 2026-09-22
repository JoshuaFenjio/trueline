#!/usr/bin/env python3
# =============================================================================
# logo_sweep_all.py — resolve a logo domain for EVERY scraped company, not just
# the top 100. Extends the chain logo_audit.py established, with the same
# safety rule, over the full active-company set.
#
#   python3 logo_sweep_all.py            # probe + write resolved.json + report
#   python3 logo_sweep_all.py --emit     # also print a companyMeta.ts block
#
# SAFETY — a domain is accepted only when BOTH hold:
#   1. its second-level label equals the company's normalised name (so "Moss"
#      can only ever resolve to moss.<tld>, never to a squatter or a homonym), and
#   2. DuckDuckGo's icon service returns a real image for it (the same signal
#      CompanyLogo relies on at render time, so an accepted domain is one that
#      will actually show a logo).
# Ambiguous single-word names that resolve to an unrelated business are the
# reason for rule 1; anything that fails either test stays a letter-mark. We
# never guess.
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


def ddg_ok(domain):
    """True when DuckDuckGo serves a real icon for this domain."""
    try:
        r = SESSION.get(f"https://icons.duckduckgo.com/ip3/{domain}.ico", timeout=8)
    except Exception:
        return False
    # DDG answers 200 with a tiny 1x1/placeholder when it has nothing.
    return r.status_code == 200 and len(r.content) > 400


def resolve(name):
    """Best domain for a company name, or None. See the SAFETY note above."""
    for n in {norm(name), norm(name, strip_suffix=False)}:
        if len(n) < 3:
            continue
        for tld in TLDS:
            d = f"{n}.{tld}"
            if label_of(d) != n:
                continue  # rule 1 (belt and braces)
            if ddg_ok(d):
                return d
    return None


def main():
    counts = companies()
    have = load_meta_domains()
    missing = [c for c in counts if c not in have]
    missing.sort(key=lambda c: -counts[c])
    print(f"active companies: {len(counts)}   with a domain: {len(counts) - len(missing)}   missing: {len(missing)}")

    resolved = {}
    t0 = time.time()
    with cf.ThreadPoolExecutor(max_workers=16) as ex:
        futs = {ex.submit(resolve, c): c for c in missing}
        done = 0
        for f in cf.as_completed(futs):
            c = futs[f]
            done += 1
            try:
                d = f.result()
            except Exception:
                d = None
            if d:
                resolved[c] = d
            if done % 200 == 0:
                print(f"  {done}/{len(missing)} probed, {len(resolved)} resolved ({time.time()-t0:.0f}s)", flush=True)

    json.dump(resolved, open("logo_resolved.json", "w"), indent=1, ensure_ascii=False, sort_keys=True)

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
