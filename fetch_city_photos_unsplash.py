#!/usr/bin/env python3
# =============================================================================
# fetch_city_photos_unsplash.py — city/country hero photos from Unsplash.
#
# Unsplash License permits commercial use; we still credit the photographer +
# Unsplash (rendered on /methodology) and trigger the API download endpoint per
# Unsplash's guidelines. Needs UNSPLASH_ACCESS_KEY in the env (or web/.env.local).
#
# Per target: search a bright landscape skyline -> QA gate -> download raw@1600
# -> WebP (~150-250KB) -> web/public/cities/<slug>.webp. Then AUTO-REWRITES the
# WITH_PHOTO set and PHOTO_CREDITS map in web/lib/cityImages.ts.
#
# The QA gate (see score()) is the contact-sheet review made repeatable. The
# first pass shipped 14 weak heroes — night silhouettes where the city was an
# orange smear (Tallinn, Krakow), hazy frames that were 70% empty sky (Madrid,
# Barcelona), and shots where the city was a distant smudge (Warsaw). Each
# candidate is now downloaded, measured and rejected before it can become a
# hero; the loop walks the whole result page and falls back to the next query.
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
# Fallback queries, tried in order when the first one yields nothing that
# passes the QA gate. Written for the targets the contact sheet rejected.
Q2 = {
    "Estonia": ["Tallinn old town daytime", "Tallinn rooftops summer"],
    "Tallinn": ["Tallinn old town daytime", "Tallinn rooftops summer"],
    "Krakow": ["Krakow main square daytime", "Krakow old town summer"],
    "Amsterdam": ["Amsterdam canal houses sunny", "Amsterdam city daylight"],
    "Netherlands": ["Amsterdam canal houses sunny", "Rotterdam skyline day"],
    "Madrid": ["Madrid Gran Via daytime", "Madrid city centre day"],
    "Spain": ["Madrid Gran Via daytime", "Barcelona city daylight"],
    "Barcelona": ["Barcelona Sagrada Familia city", "Barcelona city daylight"],
    "Cardiff": ["Cardiff city centre", "Cardiff bay buildings"],
    "Poland": ["Warsaw skyscrapers daytime", "Warsaw old town day"],
    "Warsaw": ["Warsaw skyscrapers daytime", "Warsaw old town day"],
    "Lisbon": ["Lisbon Alfama rooftops day", "Lisbon tram city"],
    "Portugal": ["Lisbon Alfama rooftops day", "Porto Ribeira daytime"],
    "Hamburg": ["Hamburg Speicherstadt daytime", "Hamburg harbour day"],
    "Italy": ["Milan Duomo daytime", "Rome skyline daytime", "Florence Duomo daytime"],
    "Milan": ["Milan Duomo daytime", "Milan Porta Nuova skyline"],
}

# Second contact-sheet pass. These five came back with the same first result —
# the generic query has a sticky top hit — so their PRIMARY query is replaced
# with something specific enough to return a different, better frame.
Q_OVERRIDE = {
    "Krakow": "Krakow Wawel castle daytime",
    "Amsterdam": "Amsterdam Herengracht canal daylight",
    "Barcelona": "Barcelona Eixample aerial daytime",
    "Cardiff": "Cardiff Principality Stadium city",
    "Hamburg": "Hamburg Elbphilharmonie daytime",
}
Q2.update({
    "Krakow": ["Krakow Cloth Hall square", "Krakow old town summer"],
    "Amsterdam": ["Amsterdam bikes canal bridge", "Amsterdam canal houses sunny"],
    "Barcelona": ["Barcelona Gothic Quarter street", "Barcelona city daylight"],
    "Cardiff": ["Cardiff Bay Mermaid Quay", "Cardiff city centre"],
    "Hamburg": ["Hamburg canal warehouse district", "Hamburg harbour day"],
})

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
                             "per_page": 12, "content_filter": "high"},
                     headers={"Authorization": "Client-ID " + KEY,
                              "Accept-Version": "v1"}, timeout=TIMEOUT)
    r.raise_for_status()
    return r.json().get("results", [])


def score(im):
    """Reject a candidate hero before it can ship. Returns (ok, why, stats).

    Thresholds were derived by grading the first pass on a contact sheet and
    then finding numbers that separate the keepers from the rejects:

      mean luminance 98-205   night silhouettes where the city is an orange
                              smear (Tallinn, Krakow) and hazy near-dark frames
                              (Madrid) both make the place unreadable
      contrast (stdev) >= 26  flat, hazy frames have almost no tonal separation
      detail >= 20            edge energy across the middle band, where a
                              skyline sits: a distant smudge on the horizon
                              (Warsaw) scores ~11, a legible city 35-55
      top-third stdev <= 70   a very non-uniform top third means something is
                              in front of the view — the Lisbon frame had a
                              tree branch across it

    The gate catches the majority; a human contact sheet is still the final
    check, and anything it flags gets an explicit fallback query in Q2.
    """
    from PIL import ImageFilter, ImageStat
    g = im.convert("L").resize((320, 200), Image.LANCZOS)
    st = ImageStat.Stat(g)
    mean, sd = st.mean[0], st.stddev[0]
    topsd = ImageStat.Stat(g.crop((0, 0, 320, 66))).stddev[0]
    band = g.crop((0, 60, 320, 180)).filter(ImageFilter.FIND_EDGES)
    detail = ImageStat.Stat(band).mean[0]
    stats = dict(mean=round(mean, 1), sd=round(sd, 1), topsd=round(topsd, 1), detail=round(detail, 1))
    if not (98 <= mean <= 205):
        return False, "luminance", stats
    if sd < 26:
        return False, "flat", stats
    if detail < 20:
        return False, "no-detail", stats
    if topsd > 70:
        return False, "obstructed", stats
    return True, "ok", stats


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
    queries = [Q_OVERRIDE.get(name) or Q.get(name) or (name + " skyline")] + Q2.get(name, [])
    rejected = []
    for query in queries:
        try:
            results = search(query)
        except Exception as e:
            print("   search error:", e)
            continue
        for p in results:
            raw_url = (p.get("urls") or {}).get("raw")
            if not raw_url:
                continue
            try:
                img = requests.get(raw_url + "&w=1600&q=80&fm=jpg&fit=crop",
                                   headers={"Authorization": "Client-ID " + KEY}, timeout=TIMEOUT)
                if img.status_code != 200 or len(img.content) < 20_000:
                    continue
                im = Image.open(io.BytesIO(img.content)).convert("RGB")
            except Exception as e:
                print("   dl error:", e)
                continue
            ok, why, stats = score(im)
            if not ok:
                rejected.append((why, stats))
                continue
            size = to_webp(img.content, dest)
            # Unsplash guideline: register the download.
            dl = (p.get("links") or {}).get("download_location")
            if dl:
                try:
                    requests.get(dl, headers={"Authorization": "Client-ID " + KEY}, timeout=15)
                except Exception:
                    pass
            return {"slug": slug, "bytes": size, "query": query, "stats": stats,
                    "rejected": len(rejected),
                    "author": (p.get("user") or {}).get("name", ""),
                    "link": (p.get("links") or {}).get("html", "")}
    if rejected:
        from collections import Counter
        print("   rejected {}: {}".format(len(rejected), dict(Counter(w for w, _ in rejected))))
    return None


def rewrite_ts(entries):
    """Merge the fetched set into WITH_PHOTO + PHOTO_CREDITS in cityImages.ts.

    MERGES rather than replaces: a subset run (re-fetching the few places the
    contact sheet rejected) must not delete the other 26 entries, which is
    exactly what a wholesale rewrite did."""
    src = open(TS).read()

    existing_slugs = set(re.findall(r'^\s*"([a-z0-9-]+)",\s*$',
                                    re.search(r"const WITH_PHOTO = new Set<string>\(\[(.*?)\]\);", src, re.S).group(1),
                                    re.M))
    existing_creds = dict(re.findall(
        r'"([a-z0-9-]+)":\s*\{ author: "([^"]*)", source: "Unsplash", link: "([^"]*)" \}',
        re.search(r"export const PHOTO_CREDITS: Record<string, PhotoCredit> = \{(.*?)\};", src, re.S).group(1)
    ) and {m[0]: (m[1], m[2]) for m in re.findall(
        r'"([a-z0-9-]+)":\s*\{ author: "([^"]*)", source: "Unsplash", link: "([^"]*)" \}',
        re.search(r"export const PHOTO_CREDITS: Record<string, PhotoCredit> = \{(.*?)\};", src, re.S).group(1))} or {})

    for e in entries:
        existing_slugs.add(e["slug"])
        existing_creds[e["slug"]] = (e["author"], e["link"])

    slugs = sorted(existing_slugs)
    wp = "const WITH_PHOTO = new Set<string>([\n" + \
        "".join('  "{}",\n'.format(s) for s in slugs) + "]);"
    src = re.sub(r"const WITH_PHOTO = new Set<string>\(\[.*?\]\);", lambda _m: wp, src, count=1, flags=re.S)
    cred = "export const PHOTO_CREDITS: Record<string, PhotoCredit> = {\n" + \
        "".join('  "{}": {{ author: {}, source: "Unsplash", link: {} }},\n'.format(
            k, _q(existing_creds[k][0]), _q(existing_creds[k][1])) for k in sorted(existing_creds)) + "};"
    src = re.sub(r"export const PHOTO_CREDITS: Record<string, PhotoCredit> = \{.*?\};", lambda _m: cred, src, count=1, flags=re.S)
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
            print("{:<16} ok   {:>6}B  {:<28} {} (rejected {})".format(
                name, res["bytes"], res["author"][:28], res["stats"], res["rejected"]))
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
