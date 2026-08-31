#!/usr/bin/env python3
# =============================================================================
# logo_audit.py — audit logo coverage for ALL scraped companies and safely
# resolve missing domains. A company shows a real logo iff companyMeta has a
# `website` AND DuckDuckGo's icon service returns 200 for it (same signal the
# CompanyLogo component relies on). Everything else falls back to a letter mark.
#
#   python3 logo_audit.py          # audit + probe, print before/after + additions
#
# Safety: an auto-resolved domain is accepted ONLY when its second-level label
# equals the company's normalised name AND DDG returns 200 — so we never attach a
# squatter/unrelated logo.
# =============================================================================
import concurrent.futures as cf
import os
import re
import time
import urllib.request
from collections import Counter

import requests

REST = os.environ["SUPABASE_URL"].rstrip("/") + "/rest/v1/job_postings"
KEY = os.environ["SUPABASE_SERVICE_KEY"]
H = {"apikey": KEY, "Authorization": "Bearer " + KEY}
TLDS = ["com", "io", "ai", "co", "app", "dev", "tech", "eu", "fr", "de", "nl", "se", "fi", "es", "it", "pl"]


def norm(s):
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


def load_meta_domains():
    src = open("web/lib/companyMeta.ts").read()
    # name (quoted or bare) ... website: "domain"
    out = {}
    for m in re.finditer(r'(?:"([^"]+)"|([A-Za-z][\w.&+\- ]*?))\s*:\s*\{[^}]*?website:\s*"([^"]+)"', src):
        out[(m.group(1) or m.group(2)).strip()] = m.group(3)
    return out


def companies():
    out, off = [], 0
    while True:
        for _ in range(4):
            try:
                r = requests.get(REST, headers=dict(H, **{"Range": f"{off}-{off+999}"}),
                                 params={"status": "eq.active", "order": "id.asc", "select": "company"}, timeout=60)
                b = r.json(); break
            except Exception:
                time.sleep(2); b = []
        if not isinstance(b, list) or not b:
            break
        out += b
        if len(b) < 1000:
            break
        off += 1000
    return Counter(x["company"] for x in out if x.get("company"))


def ddg_ok(domain):
    try:
        req = urllib.request.Request(f"https://icons.duckduckgo.com/ip3/{domain}.ico", method="HEAD")
        with urllib.request.urlopen(req, timeout=12) as r:
            return r.status == 200
    except Exception:
        return False


# Recognised WRONG/ambiguous same-name domains — a different company owns the
# guessable domain, so a DDG icon there would be the wrong logo. Left to the
# honest letter-mark instead.
BLACKLIST = {
    "Applied", "Moss", "FINN", "Emag", "Tamara", "Trigo", "Endel", "Headway",
    "Nested", "Robco", "Lovable", "Fractile", "Believe", "Genesis", "Griffin",
    "Oyster", "Symphony", "Shine", "Lighthouse", "Hala", "Remote",
}


def title_ok(domain, name):
    """Second gate: the domain's homepage <title> must mention the company —
    filters squatters and same-name-different-company .coms."""
    core = norm(name)
    words = [w for w in re.split(r"[^a-z0-9]+", name.lower()) if len(w) >= 4]
    try:
        req = urllib.request.Request("https://" + domain, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=8) as r:
            html = r.read(20000).decode("utf-8", "replace")
    except Exception:
        return False
    m = re.search(r"<title[^>]*>(.*?)</title>", html, re.I | re.S)
    meta = re.search(r'og:site_name"[^>]*content="([^"]+)"', html, re.I)
    hay = norm((m.group(1) if m else "") + " " + (meta.group(1) if meta else ""))
    if not hay:
        return False
    return core in hay or any(norm(w) in hay for w in words)


def resolve(name):
    """Return a verified domain: core == normalised name, DDG-200, AND homepage
    title mentions the company. None otherwise (honest letter-mark)."""
    if name in BLACKLIST:
        return None
    core = norm(name)
    if len(core) < 3:
        return None
    for tld in TLDS:
        d = f"{core}.{tld}"
        if ddg_ok(d) and title_ok(d, name):
            return d
    return None


def main():
    counts = companies()
    meta = load_meta_domains()
    names = sorted(counts, key=lambda n: -counts[n])
    total = len(names)

    # BEFORE: has a domain that actually returns a logo
    have_domain = [n for n in names if meta.get(n)]
    def check(n):
        return n, ddg_ok(meta[n])
    working = set()
    with cf.ThreadPoolExecutor(max_workers=16) as ex:
        for n, ok in ex.map(check, have_domain):
            if ok:
                working.add(n)
    broken = [n for n in have_domain if n not in working]           # domain present but 404
    missing = [n for n in names if not meta.get(n)]                  # no domain at all

    print("=" * 66)
    print("LOGO AUDIT — {} scraped companies".format(total))
    print("=" * 66)
    print("BEFORE  working logo : {} ({:.0f}%)".format(len(working), 100 * len(working) / max(1, total)))
    print("        domain, 404  : {}".format(len(broken)))
    print("        no domain    : {}".format(len(missing)))

    # Resolve broken + missing — prioritise by posting volume, cap the probe set.
    todo = sorted(broken + missing, key=lambda n: -counts[n])[:400]
    found = {}
    with cf.ThreadPoolExecutor(max_workers=12) as ex:
        for name, dom in zip(todo, ex.map(resolve, todo)):
            if dom and dom != meta.get(name):
                found[name] = dom

    print("\nRESOLVED {} new/fixed domains (verified DDG-200, core matches name):".format(len(found)))
    for n in sorted(found, key=lambda n: -counts[n])[:60]:
        tag = "FIX" if n in set(broken) else "NEW"
        print("  [{}] {:<26} {:<26} ({} postings)".format(tag, n[:25], found[n], counts[n]))

    after = len(working) + len(found)
    print("\nAFTER   working logo : {} ({:.0f}%)  (+{})".format(after, 100 * after / max(1, total), len(found)))

    # emit a TS snippet to paste/merge
    import json
    open("logo_additions.json", "w").write(json.dumps(found, indent=2))
    print("wrote logo_additions.json")


if __name__ == "__main__":
    main()
