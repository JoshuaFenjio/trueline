#!/usr/bin/env python3
# =============================================================================
# sweep.py — DIRECTED company sweep. Name-guessing was exhausted at ~5.5% hit
# rate; this instead works from a curated list of *real* recognisable EMEA tech
# employers (unicorns / scale-ups / notable) per country, dedups against what we
# already track, probes all ATS via resolver.resolve_company, and reports yield.
#
#   python3 sweep.py            # probe, print yield, write sweep_out.json
#
# Resolved (found on a public ATS) -> append to companies.py, scrape.
# Unresolved (recognisable but on an enterprise ATS / no public board)
#   -> watchlist candidates (honest "we track them, no public pay" page).
# =============================================================================
import concurrent.futures as cf
import json
import re
import sys

from companies import COMPANIES
from resolver import resolve_company, load_cache, save_cache

# Curated real EMEA tech employers, by country. Dedup below removes any we
# already track, so this can overlap the existing list freely.
NEW = {
 "UK": ["Revolut", "Starling Bank", "Checkout.com", "Rapyd", "OakNorth", "Freetrade",
        "Moneybox", "Curve", "ClearScore", "Modulr", "Yapily", "Allica Bank", "Kroo",
        "Paddle", "Darktrace", "Snyk", "Onfido", "Tractable", "Signal AI", "Builder.ai",
        "Cazoo", "Cinch", "Zego", "ManyPets", "Habito", "Goodlord", "Octopus Energy",
        "OVO Energy", "Gymshark", "THG", "Lyst", "Olio", "Zilch", "Attest", "Permutive",
        "Tessian", "Privitar", "Improbable", "Five AI", "Wayflyer", "Cleo", "Lendable",
        "Zopa", "Marshmallow", "Bud", "Fnatic", "Depop", "Bloom & Wild", "Peppy",
        "Multiverse", "Beamery", "Sylvera", "Isomorphic Labs", "Wayve", "Synthesia"],
 "Ireland": ["Intercom", "Flipdish", "Fenergo", "LetsGetChecked", "Workhuman", "Manna",
             "Nuritas", "Cubic Telecom", "Tines", "TransferMate", "Ding", "Global Shares"],
 "France": ["Spendesk", "Shift Technology", "Ivalua", "Younited", "Lydia", "Sunday",
            "PhotoRoom", "Poolside", "Holistic AI", "Exotec", "Verkor", "Ynsect",
            "Electra", "Pasqal", "Alice & Bob", "Getaround", "BlaBlaCar", "Malt",
            "360Learning", "Lucca", "ManoMano", "Descartes Underwriting", "Withings",
            "Qair", "Mirakl", "Alma", "Payplug", "Luko", "Ledger", "Kyutai", "Mistral AI"],
 "Germany": ["Flix", "Wefox", "Solaris", "Raisin", "Scalable Capital", "Taxfix",
             "Sennder", "Forto", "Grover", "Choco", "Enpal", "1Komma5Grad", "Tourlane",
             "McMakler", "Clark", "CoachHub", "Staffbase", "Egym", "Isar Aerospace",
             "The Mobility House", "Aleph Alpha", "Parloa", "Volocopter", "Lilium",
             "Agile Robots", "NavVis", "Konux", "Circ", "Pitch", "Aleph Alpha", "Ada Health"],
 "Netherlands": ["Bunq", "Backbase", "Mambu", "Framer", "WeTransfer", "Bitvavo",
                 "Otrium", "Studocu", "Silverfin", "Felyx", "Crisp", "Swapfiets",
                 "Lightyear", "Nebius", "Castor", "MyTomorrows", "Dyme", "Recharge"],
 "Sweden": ["Klarna", "Northvolt", "Einride", "Mentimeter", "Tink", "Trustly", "Anyfin",
            "Juni", "Mynt", "Budbee", "Instabee", "Mathem", "Normative", "Sana Labs",
            "Sellpy", "Yubico", "Funnel", "Quinyx", "Oneflow", "Fortnox", "Sinch",
            "Storytel", "Voyado", "Natural Cycles", "Stegra", "Polestar", "Volta Trucks"],
 "Denmark": ["Templafy", "Podimo", "Corti", "Dixa", "Vivino", "Planday", "Forecast",
             "Queue-it", "Airtame", "Pento", "Ageras", "Monta", "Zenegy", "Cardlay"],
 "Norway": ["Kahoot", "Remarkable", "Oda", "Tibber", "Ardoq", "Huddly", "No Isolation",
            "Xeneta", "Unacast", "Vipps", "Zwipe", "Cognite", "Gelato"],
 "Finland": ["Supercell", "Rovio", "Smartly.io", "RELEX Solutions", "IQM", "Varjo",
             "Wirepas", "Silo AI", "Enfuce", "Framery", "ICEYE", "Swappie", "Oura"],
 "Spain": ["TravelPerk", "Factorial", "Jobandtalent", "Wallbox", "Fever", "Red Points",
           "Seedtag", "Idealista", "Cobee", "Payflow", "Bit2Me", "Clarity AI", "Devo",
           "Copado", "Genially", "Holaluz", "Exoticca", "Colvin", "Multiverse Computing"],
 "Italy": ["Scalapay", "Satispay", "Bending Spoons", "Casavo", "Moneyfarm", "Young Platform",
           "Cortilia", "Everli", "Newcleo", "D-Orbit", "Soldo", "Fabrick", "Credimi", "Musixmatch"],
 "Portugal": ["Feedzai", "Talkdesk", "Sword Health", "Unbabel", "OutSystems", "Anchorage",
              "Defined.ai", "Barkyn", "Coverflex", "Sensei", "Cleverly", "Kitch"],
 "Poland": ["Docplanner", "Booksy", "Packhelp", "Vue Storefront", "Nomagic", "Sundose",
            "Tidio", "Brand24", "Zowie", "Infermedica", "CallPage", "Preply", "Ramp Network"],
 "Baltics": ["Veriff", "Skeleton Technologies", "Starship Technologies", "Katana", "Salv",
             "Montonio", "Glia", "Comodule", "Xolo", "Oxylabs", "Omnisend", "CGTrader",
             "TransferGo", "Kilo Health", "Interactio", "Whatagraph", "Hostinger", "Trafi"],
 "Switzerland": ["On", "Scandit", "Nexthink", "Frontify", "Yokoy", "Ledgy", "Climeworks",
                 "Flyability", "Beekeeper", "Unique", "LatticeFlow", "DeepJudge", "Sophia Genetics"],
 "Austria": ["Bitpanda", "GoStudent", "TourRadar", "Adverity", "Prewave", "Refurbed",
             "Anyline", "Blockpit", "Kern Tec", "Storyblok"],
 "Belgium": ["Odoo", "Deliverect", "Showpad", "Teamleader", "Sentiance", "Aikido Security",
             "Henchman", "Silverfin", "Collibra"],
 "Israel": ["Wiz", "Monday.com", "Melio", "Fireblocks", "Gong", "Riskified", "Lightricks",
            "Papaya Global", "Aidoc", "Deel"],
}


def norm(s):
    return re.sub(r"[^a-z0-9]", "", s.lower())


def main():
    tracked = {norm(c["name"]) for c in COMPANIES}
    try:
        wl = open("web/lib/watchlist.ts").read()
        tracked |= {norm(n) for n in re.findall(r'name:\s*"([^"]+)"', wl)}
    except FileNotFoundError:
        pass

    todo, seen = [], set()
    for country, names in NEW.items():
        for n in names:
            k = norm(n)
            if k in tracked or k in seen:
                continue
            seen.add(k)
            todo.append((n, country))

    print("curated: {} names across {} countries".format(
        sum(len(v) for v in NEW.values()), len(NEW)))
    print("already tracked / dup: {}".format(sum(len(v) for v in NEW.values()) - len(todo)))
    print("to probe (new): {}\n".format(len(todo)))

    cache = load_cache()
    resolved, unresolved = [], []

    def work(item):
        name, country = item
        r = resolve_company(name, cache=cache)
        return name, country, r

    with cf.ThreadPoolExecutor(max_workers=8) as ex:
        for name, country, r in ex.map(work, todo):
            if r.get("ats"):
                cache[name] = r
                resolved.append((name, country, r["ats"], r["token"], r["count"]))
            else:
                unresolved.append((name, country))
    save_cache(cache)

    resolved.sort(key=lambda x: -x[4])
    print("=" * 70)
    print("RESOLVED on a public ATS: {} / {}  ({:.0f}%)".format(
        len(resolved), len(todo), 100 * len(resolved) / max(1, len(todo))))
    print("=" * 70)
    for name, country, ats, token, cnt in resolved:
        print("  {:<22} {:<12} {:<14} {:<18} {} jobs".format(name[:21], country, ats, token[:17], cnt))
    print("\nUNRESOLVED (watchlist candidates): {}".format(len(unresolved)))
    print("  " + ", ".join(n for n, _ in unresolved))

    json.dump({
        "resolved": [{"name": n, "country": c, "ats": a, "token": t, "count": cnt}
                     for n, c, a, t, cnt in resolved],
        "unresolved": [{"name": n, "country": c} for n, c in unresolved],
    }, open("sweep_out.json", "w"), indent=2)
    print("\nwrote sweep_out.json")


if __name__ == "__main__":
    main()
