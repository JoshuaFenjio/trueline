#!/usr/bin/env python3
# =============================================================================
# fetch_city_photos_unsplash.py — city/country hero photos from Unsplash.
#
# Unsplash License permits commercial use; we still credit the photographer +
# Unsplash (rendered on /methodology) and trigger the API download endpoint per
# Unsplash's guidelines. Needs UNSPLASH_ACCESS_KEY in the env (or web/.env.local).
#
# Per target: search a bright landscape skyline -> download raw@1600 -> WebP
# (~150-250KB) -> web/public/cities/<slug>.webp. Then AUTO-REWRITES the
# WITH_PHOTO set and PHOTO_CREDITS map in web/lib/cityImages.ts.
#
#   venv/bin/python3 fetch_city_photos_unsplash.py            # all targets
#   venv/bin/python3 fetch_city_photos_unsplash.py London     # subset
# =============================================================================
import io
import os
import re
import sys
import time

import requests
from PIL import Image

OUT = "web/public/cities"
TS = "web/lib/cityImages.ts"
TIMEOUT = 40

CITIES = ["London", "Berlin", "Munich", "Paris", "Vilnius", "Dublin", "Milan",
          "Tallinn", "Warsaw", "Madrid", "Barcelona", "Lisbon", "Amsterdam",
          "Vienna", "Stockholm", "Cardiff", "Brussels", "Copenhagen", "Zurich",
          "Manchester", "Cologne", "Hamburg", "Krakow", "Porto"]
COUNTRIES = ["United Kingdom", "Germany", "France", "Netherlands", "Poland",
             "Estonia", "Sweden", "Italy", "Ireland", "Portugal", "Austria",
             "Spain", "Belgium", "Lithuania", "Switzerland", "Denmark"]

# Query per target — bright, iconic. Countries map to a recognisable skyline.
Q = {
    "United Kingdom": "London skyline", "Germany": "Berlin skyline",
    "France": "Paris Eiffel Tower skyline", "Netherlands": "Amsterdam canal",
    "Poland": "Warsaw skyline", "Estonia": "Tallinn old town",
    "Sweden": "Stockholm old town skyline", "Italy": "Florence skyline",
    "Ireland": "Dublin city", "Portugal": "Lisbon skyline", "Austria": "Vienna skyline",
    "Spain": "Madrid skyline", "Belgium": "Brussels grand place", "Lithuania": "Vilnius old town",
    "Switzerland": "Zurich city lake", "Denmark": "Copenhagen Nyhavn",
}


def slugify(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def load_key():
    k = os.environ.get("UNSPLASH_ACCESS_KEY")
    if k:
        return k
    try:
        for line in open("web/.env.local"):
            if line.startswith("UNSPLASH_ACCESS_KEY="):
                return line.split("=", 1)[1].strip().strip('"')
    except FileNotFoundError:
        pass
    return None


KEY = load_key()


def search(query):
    r = requests.get("https://api.unsplash.com/search/photos",
                     params={"query": query, "orientation": "landscape",
                             "per_page": 6, "content_filter": "high"},
                     headers={"Authorization": "Client-ID " + KEY,
                              "Accept-Version": "v1"}, timeout=TIMEOUT)
    r.raise_for_status()
    return r.json().get("results", [])


def to_webp(raw, path):
    im = Image.open(io.BytesIO(raw)).convert("RGB")
    if im.width > 1600:
        im = im.resize((1600, round(im.height * 1600 / im.width)), Image.LANCZOS)
    for q in (82, 74, 66, 58, 50):
        buf = io.BytesIO()
        im.save(buf, "WEBP", quality=q, method=6)
        if buf.tell() <= 260_000:
            break
    open(path, "wb").write(buf.getvalue())
    return buf.tell()


def fetch(name, is_country):
    slug = slugify(name)
    dest = os.path.join(OUT, slug + ".webp")
    query = Q.get(name) or (name + " skyline")
    try:
        results = search(query)
    except Exception as e:
        print("   search error:", e); return None
    for p in results:
        raw_url = (p.get("urls") or {}).get("raw")
        if not raw_url:
            continue
        try:
            img = requests.get(raw_url + "&w=1600&q=80&fm=jpg&fit=crop",
                               headers={"Authorization": "Client-ID " + KEY}, timeout=TIMEOUT)
            if img.status_code != 200 or len(img.content) < 20_000:
                continue
            size = to_webp(img.content, dest)
        except Exception as e:
            print("   dl/encode error:", e); continue
        # Unsplash guideline: register the download.
        dl = (p.get("links") or {}).get("download_location")
        if dl:
            try:
                requests.get(dl, headers={"Authorization": "Client-ID " + KEY}, timeout=15)
            except Exception:
                pass
        return {"slug": slug, "bytes": size,
                "author": (p.get("user") or {}).get("name", ""),
                "link": (p.get("links") or {}).get("html", "")}
    return None


def rewrite_ts(entries):
    """Rewrite WITH_PHOTO + PHOTO_CREDITS in cityImages.ts from the fetched set."""
    src = open(TS).read()
    slugs = sorted(e["slug"] for e in entries)
    wp = "const WITH_PHOTO = new Set<string>([\n" + \
        "".join('  "{}",\n'.format(s) for s in slugs) + "]);"
    src = re.sub(r"const WITH_PHOTO = new Set<string>\(\[.*?\]\);", wp, src, count=1, flags=re.S)
    cred = "export const PHOTO_CREDITS: Record<string, PhotoCredit> = {\n" + \
        "".join('  "{}": {{ author: {}, source: "Unsplash", link: {} }},\n'.format(
            e["slug"], _q(e["author"]), _q(e["link"])) for e in sorted(entries, key=lambda x: x["slug"])) + "};"
    src = re.sub(r"export const PHOTO_CREDITS: Record<string, PhotoCredit> = \{.*?\};", cred, src, count=1, flags=re.S)
    open(TS, "w").write(src)


def _q(s):
    return '"' + (s or "").replace('\\', '').replace('"', "'") + '"'


def main():
    if not KEY:
        print("NO UNSPLASH_ACCESS_KEY — add it to web/.env.local or the env, then re-run.")
        sys.exit(1)
    os.makedirs(OUT, exist_ok=True)
    only = set(sys.argv[1:])
    targets = [(c, False) for c in CITIES] + [(c, True) for c in COUNTRIES]
    if only:
        targets = [(n, ic) for n, ic in targets if n in only]
    entries, none = [], []
    for name, is_country in targets:
        res = fetch(name, is_country)
        if res:
            entries.append(res)
            print("{:<16} ok   {:>6}B  {}".format(name, res["bytes"], res["author"]))
        else:
            none.append(name)
            print("{:<16} none".format(name))
        time.sleep(0.5)
    if entries:
        rewrite_ts(entries)
    print("\n{}/{} fetched; {} silhouette-fallback: {}".format(
        len(entries), len(targets), len(none), ", ".join(none) or "-"))


if __name__ == "__main__":
    main()
