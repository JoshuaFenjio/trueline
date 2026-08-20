#!/usr/bin/env python3
# =============================================================================
# resolver.py — figure out which ATS (and token) each company uses.
#
# WHAT IT DOES (plain English):
#   You give it a company NAME. It invents a few likely "tokens" from that name
#   (e.g. "Delivery Hero" -> "deliveryhero", "delivery-hero", "DeliveryHero")
#   and politely asks each ATS in turn — greenhouse, lever, ashby,
#   smartrecruiters, recruitee, teamtailor — whether a job board exists there.
#   It uses the FIRST ats+token that returns at least one job.
#
#   Results are cached to .resolver_cache.json so re-runs are fast.
#
# HOW TO USE:
#   python3 resolver.py        # resolves the list below, rewrites companies.py
#
# Then run the pipeline as usual: python3 pipeline.py
# =============================================================================

import os
import re
import json
import time

import requests

USER_AGENT = "TruelineJobsBot/1.0 (+salary-benchmarking; contact: jobs@trueline.local)"
HEADERS = {"User-Agent": USER_AGENT, "Accept": "application/json"}
PROBE_TIMEOUT = 6          # seconds per probe (kept short so dead boards fail fast)
POLITE_DELAY = 0.2         # pause between probes
CACHE_FILE = ".resolver_cache.json"

# -----------------------------------------------------------------------------
# Known-good companies — locked in so the resolver can't "re-break" them.
#   name -> (ats, token)
# -----------------------------------------------------------------------------
SEED = {
    "ElevenLabs":     ("ashby", "elevenlabs"),
    "Monzo":          ("greenhouse", "monzo"),
    "GoCardless":     ("greenhouse", "gocardless"),
    "Mistral AI":     ("lever", "mistral"),
    "Contentsquare":  ("lever", "contentsquare"),
    "Ledger":         ("lever", "ledger"),
    "Delivery Hero":  ("smartrecruiters", "DeliveryHero"),
}

# -----------------------------------------------------------------------------
# The EMEA company list to resolve.
# -----------------------------------------------------------------------------
COMPANY_NAMES = [
    "Adyen", "Monzo", "Revolut", "Wise", "N26", "GoCardless", "Qonto", "Pleo",
    "SumUp", "Mollie", "Klarna", "Trade Republic", "Pennylane", "Spendesk",
    "Starling Bank", "Tide", "Modulr", "Form3", "Griffin", "Lunar", "Zopa",
    "Marshmallow", "ComplyAdvantage", "Onfido", "Mistral AI", "ElevenLabs",
    "Synthesia", "Wayve", "DeepL", "PolyAI", "Stability AI", "Faculty",
    "Speechmatics", "Helsing", "Builder.ai", "Cradle", "GitLab", "Grafana Labs",
    "Snyk", "Aiven", "PostHog", "n8n", "Tinybird", "Algolia", "Celonis",
    "Dataiku", "Collibra", "Aircall", "Ledger", "Quantexa", "Matillion",
    "Featurespace", "Glovo", "Delivery Hero", "Deliveroo", "GetYourGuide",
    "Omio", "Vinted", "Wolt", "Back Market", "Depop", "Trustpilot",
    "Vestiaire Collective", "ManoMano", "Sorare", "Moonpig", "HelloFresh",
    "Gousto", "Blablacar", "Taxfix", "Skyscanner", "Farfetch", "Doctolib",
    "Alan", "Kry", "Huma", "Cera", "Flo Health", "Oura", "Personio",
    "Factorial", "HiBob", "Remote", "Oyster", "Multiplier", "Contentful",
    "Typeform", "Pitch", "Miro", "Mews", "TravelPerk", "Juro", "Beamery",
    "PayFit", "Swile", "Leapsome", "Humaans", "Pipedrive", "Darktrace",
    "Graphcore", "Truecaller", "Kahoot", "Cognite", "Contentsquare", "Peak",
    # --- 2026 expansion -----------------------------------------------------
    # AI/ML
    "Aleph Alpha", "Poolside", "H Company", "Photoroom", "Nabla", "Owkin",
    "Hugging Face", "LightOn", "Kyutai", "Black Forest Labs", "Parloa", "Langdock",
    "DeepJudge", "Lakera", "Giskard", "Dust", "Finegrain", "Gladia", "LeChat",
    "Unbabel",
    # Fintech
    "Zilch", "Curve", "Cleo", "Plum", "Moneybox", "Freetrade", "PrimaryBid",
    "Codat", "Yapily", "TrueLayer", "Volt", "Vivid Money", "Solaris", "Raisin",
    "Scalable Capital", "Bitpanda", "Ramp Network", "Payhawk", "Wamo", "Finom",
    "Bunq", "Alma", "Lydia", "Swan", "Defacto", "Memo Bank",
    # Devtools / infra
    "Sentry", "Checkly", "Appsmith", "Directus", "Strapi", "Meilisearch", "Qovery",
    "Koyeb", "Scaleway", "OVHcloud", "Upstash", "Weaviate", "Qdrant", "Neo4j",
    "Camunda", "Cypress", "Storyblok", "Hygraph", "Crowdin", "Localazy",
    # SaaS / B2B
    "Pigment", "Payflows", "360Learning", "Yousign", "Agicap", "Sellsy", "Odoo",
    "Teamleader", "Silae", "Combo", "Skello", "Shine", "Regate", "Libeo", "Upflow",
    "Front", "Intercom", "Matomo", "Klaxoon", "Slite", "Notion", "Whereby",
    "Superside",
    # Consumer / marketplace / mobility
    "Too Good To Go", "Voi", "Tier Mobility", "Bolt", "Heetch", "Cabify",
    "Free Now", "Flink", "Getir", "Picnic", "Rohlik", "La Fourche", "Ankorstore",
    "Mirakl", "Veepee", "Zalando", "About You", "Otto Group", "Douglas", "Idealo",
    # Health / bio
    "Zava", "Kaia Health", "Ada Health", "Doctorly", "Avi Medical", "Patient21",
    "Medwing", "Heartbeat Medical",
    # Security
    "Tines", "Detectify", "Truffle Security", "Hoxhunt", "CybelAngel", "Gatewatcher",
    # Nordics
    "Spotify", "Epidemic Sound", "Kognity", "Mentimeter", "Voyado", "Dixa",
    "Templafy", "Supermetrics", "Smartly", "Swappie", "Silo AI",
    # --- FINAL PRE-LAUNCH EXPANSION (regional depth) ------------------------
    # Nordics (SE/DK/FI/NO)
    "Northvolt", "Einride", "Tink", "Trustly", "Relex Solutions", "Reaktor",
    "Corti", "Podimo", "GoMore", "Zettle", "Anyfin", "Juni", "Quinyx", "Planhat",
    "Normative", "Sana Labs", "Budbee", "Sinch", "Tibber", "Oda", "Gelato",
    "Ardoq", "Xeneta", "Forsta", "Doktor24", "Billogram", "Mynewsdesk", "Karma",
    "Debricked", "Fishbrain",
    # Southern Europe (ES/IT/PT)
    "Jobandtalent", "Fever", "Wallbox", "Landbot", "Seedtag", "Cobee", "Exoticca",
    "Domestika", "Freepik", "Genially", "Voicemod", "Devo", "Red Points",
    "Bending Spoons", "Satispay", "Scalapay", "Casavo", "Docebo", "Musixmatch",
    "Moneyfarm", "Soldo", "Prima Assicurazioni", "Everli", "Feedzai", "Talkdesk",
    "Sword Health", "Coverflex", "Codacy", "Infraspeak",
    # Eastern Europe (PL/CZ/RO/Baltics)
    "DocPlanner", "Booksy", "Brainly", "Packhelp", "Nomagic", "Tylko", "Zowie",
    "Symmetrical", "Nethone", "Vue Storefront", "Productboard", "Rossum", "Apify",
    "Kiwi.com", "Twisto", "Ataccama", "CloudTalk", "Recombee", "Notino", "UiPath",
    "Druid AI", "FintechOS", "Bitdefender", "TypingDNA", "Veriff", "Nord Security",
    "Glia", "Salv", "Montonio", "PVcase",
    # Netherlands / Belgium
    "Bird", "Framer", "Backbase", "Bux", "Dott", "Otrium", "StuDocu", "Sendcloud",
    "Channable", "WeTransfer", "Silverflow", "Fourthline", "Zivver", "Deliverect",
    "Showpad", "Lighthouse", "Silverfin", "Henchman", "Aikido Security",
    "Intigriti", "Cowboy", "Sortlist", "Guardsquare", "Materialise", "Unifly",
    # Switzerland / Austria
    "On", "Scandit", "Frontify", "Beekeeper", "Ledgy", "Nexthink", "Yokoy",
    "Proton", "Sophia Genetics", "GoStudent", "Prewave", "Adverity", "Refurbed",
    "Anyline", "PlanRadar", "Blockpit", "Hokify", "Byrd", "LatticeFlow", "Planted",
    # Ireland
    "Workhuman", "LetsGetChecked", "Flipdish", "Wayflyer", "Nuritas", "Manna",
    "TransferMate", "Fenergo", "CurrencyFair", "Evervault", "Cubic Telecom",
    "Protex AI", "Nory", "Continuum Industries", "Ocuco",
    # Middle East (UAE / Israel)
    "Careem", "Property Finder", "Tabby", "Kitopi", "Huspy", "Alaan", "Cafu",
    "Fresha", "Bayzat", "Sarwa", "Lean Technologies", "Monday.com", "Gong",
    "Fireblocks", "Melio", "Rapyd", "JFrog", "Similarweb", "Riskified",
    "Papaya Global",
    # --- COUNTRY-DEPTH EXPANSION (deepen thin/gated markets) ----------------
    # Belgium
    "ML6", "In The Pocket", "Robovision", "Cumul.io", "EclecticIQ", "Sentiance",
    "Ontoforce", "Radix", "Faktion", "Rombit", "Citymesh", "Skryv", "iText",
    # Czechia
    "Manta", "Emplifi", "Keboola", "GoodData", "Resistant AI", "Threatmark",
    "Better Stack", "Deepnote", "Superface", "Signageos", "Livesport", "Storyous",
    # Norway
    "Otovo", "Airthings", "Huddly", "Vipps", "No Isolation", "Unloc", "Kron",
    "Spond", "Attensi", "Boost.ai", "Strise", "Two", "Ardoq",
    # Romania
    "MultiversX", "Tremend", "Softbinator", "Questo", "Bunnyshell", "Sameday",
    "TotalSoft", "Bright Spaces", "Flip", "Innoship", "2Performant", "Frisbo",
    # Denmark
    "Monta", "Ageras", "Pento", "Cardlay", "Siteimprove", "Queue-it", "Firi",
    "Kanpla", "Zenegy", "GomSpace", "Netcompany",
    # Austria
    "Bitmovin", "TourRadar", "mySugr", "Usersnap", "Celum", "Nuki", "Symflower",
    "Cropster", "Presono", "Kern Tec", "Journi", "Playbrush", "Robo Wunderkind",
    # Finland
    "Framery", "ICEYE", "Varjo", "Yousician", "Metacore", "Enfuce", "Solita",
    "Noona", "Kaiku Health", "Sharper Shape", "Woolman",
    # Portugal
    "Uphold", "Probely", "Jscrambler", "YData", "Barkyn", "Kevel", "Sensei",
    "Bizay", "Uniplaces", "Aptoide", "HUUB", "Xgeeks", "Defined.ai",
    # Ireland
    "Teamwork", "Kitman Labs", "Sedicii", "Circit", "Ding", "AMCS Group",
    "Learnovate", "PhoneWatch", "Zerve", "Boxever", "Umba",
    # Spain
    "Paack", "Capchase", "Clarity AI", "Bit2Me", "Nextail", "Lodgify", "Badi",
    "Fintonic", "Bnext", "CoverManager", "Boopos", "Ontruck",
    # Italy
    "Sysdig", "Young Platform", "Credimi", "Fabrick", "Cortilia", "Milkman",
    "Cardo AI", "MDOTM", "Axyon AI", "D-Orbit", "Newcleo", "Talent Garden", "Nextome",
    # Poland
    "Tidio", "Survicate", "Brand24", "Woodpecker", "Landingi", "Piwik PRO",
    "GetResponse", "SentiOne", "Infermedica", "Sundose", "Airly", "Restaumatic",
    # --- HOUSEHOLD NAMES (probe all; enterprise-ATS misses go to the watchlist)
    # --- ROUND 4 (census-weighted, disclosure-yield first) -----------------
    # (a) ASHBY-first: EMEA AI labs / devtools / fintech (richest disclosure)
    "Legora", "Lovable", "Neko Health", "Validio", "Deepset", "Merantix",
    "Adaptive ML", "Bioptimus", "Sifflet", "Isomorphic Labs", "PhysicsX",
    "Doccla", "Nelly", "Kittl", "Ecosia", "Tacto", "Circula", "Finmid", "Y42",
    "Choco", "Parcellab", "Kadmos", "Pliant", "Coincover", "Vitesse", "Bud",
    "Cushon", "Shift Technology", "Descartes Underwriting", "Nium", "Sardine",
    "Squirro", "Unique", "Nexoya", "Legartis", "Sennder", "Forto", "Limehome",
    "Alaiko", "Doctronic", "Fena",
    # (b) RECRUITEE: NL / BE / PL mid-market (also deepens thin countries)
    "Bynder", "Trengo", "Leaseweb", "Catawiki", "Amberscript", "Homerr",
    "Tellow", "Datacake", "Tessi", "Woorank", "Bothrs", "Pattyn", "Radix",
    "Faktion", "Rombit", "Digazu", "Sunroof", "Callpage", "Uncapped", "Cosmose",
    # (c) TEAMTAILOR: Nordics depth (Denmark especially)
    "Contractbook", "Airtame", "Famly", "Zervant", "Grafikr", "Instabee",
    "Depict", "Kognic", "Sellpy", "Bokio", "Deemly", "Modig", "Planday",
    # (d) THIN-COUNTRY gap-fill — Austria
    "Wikifolio", "Cashpresso", "Kompany", "Fretello", "TTTech", "Frequentis",
    "Waterdrop", "Tributech", "Butleroy",
    #     Switzerland
    "Climeworks", "Sygnum", "21Shares", "Amina", "Yapeal", "Amnis", "PXL Vision",
    "Nezasa", "Bexio", "Ava", "Selma", "Neustark", "Cutiss", "Distalmotion",
    "Sonect", "Planted",
    #     Denmark / Nordics extra
    "Cardlay", "Zenegy", "Lakrids", "Peakon",
    # --- HOUSEHOLD NAMES (probe all; enterprise-ATS misses go to the watchlist)
    "Uber", "Airbnb", "Booking.com", "Netflix", "Amazon", "Google", "Microsoft",
    "Apple", "Meta", "TikTok", "Snap", "Pinterest", "LinkedIn", "PayPal",
    "Just Eat Takeaway", "Ryanair", "easyJet", "Trainline", "Expedia", "eBay",
    "Etsy", "Shopify", "ASOS", "Allegro", "Rakuten", "Grab", "Talabat",
    "Foodpanda", "Zomato", "DoorDash", "Instacart", "Adidas", "Nike", "IKEA",
    "Lego", "Philips", "Bosch", "Siemens", "SAP", "Salesforce", "Oracle", "IBM",
    "Cisco", "VMware", "Nvidia", "Intel", "Dell", "Zoom", "Slack", "Dropbox",
    "Box", "Zendesk", "Freshworks", "HubSpot", "Squarespace", "Atlassian",
    "Datadog", "Snowflake", "MongoDB", "Elastic", "Twilio", "Cloudflare",
    "DigitalOcean", "GitHub", "Docker", "HashiCorp", "Databricks", "OpenAI",
    "Anthropic", "Cohere", "Canva", "Figma", "Airtable", "Asana", "Miro",
    "Ubisoft", "King", "Rovio", "Supercell", "Unity", "Palantir", "Expedia",
]


# -----------------------------------------------------------------------------
# Token candidate generation
# -----------------------------------------------------------------------------
def _words(name):
    # Split on whitespace, strip non-alphanumerics from each word.
    return [re.sub(r"[^A-Za-z0-9]", "", w) for w in name.split() if w.strip()]


def lower_nospace(name):
    return "".join(_words(name)).lower()


def hyphenated(name):
    return "-".join(_words(name)).lower()


def camel_nospace(name):
    return "".join(w[:1].upper() + w[1:] for w in _words(name))


def candidate_tokens(name):
    """The three requested forms, de-duplicated, order preserved."""
    out = []
    for tok in (lower_nospace(name), hyphenated(name), camel_nospace(name)):
        if tok and tok not in out:
            out.append(tok)
    return out


def subdomain_tokens(name):
    """Recruitee/Teamtailor tokens are URL subdomains -> lowercase only."""
    out = []
    for tok in (lower_nospace(name), hyphenated(name)):
        if tok and tok not in out:
            out.append(tok)
    return out


# -----------------------------------------------------------------------------
# Probing — returns a job count (0 means "no board / no jobs / error")
# -----------------------------------------------------------------------------
def _get(url):
    for attempt in range(2):  # one retry, only on network errors
        try:
            r = requests.get(url, headers=HEADERS, timeout=PROBE_TIMEOUT)
            if r.status_code == 200:
                return r.json()
            return None  # 404 etc. — board doesn't exist, no point retrying
        except Exception:
            time.sleep(0.4)
    return None


def _get_text(url):
    """Like _get but returns raw text (for the Teamtailor RSS feed)."""
    for attempt in range(2):
        try:
            r = requests.get(url, headers=HEADERS, timeout=PROBE_TIMEOUT)
            if r.status_code == 200:
                return r.text
            return None
        except Exception:
            time.sleep(0.4)
    return None


def probe_count(ats, token):
    try:
        if ats == "greenhouse":
            d = _get("https://boards-api.greenhouse.io/v1/boards/{}/jobs".format(token))
            if isinstance(d, dict) and isinstance(d.get("jobs"), list):
                return len(d["jobs"])
        elif ats == "lever":
            d = _get("https://api.lever.co/v0/postings/{}?mode=json".format(token))
            if isinstance(d, list):
                return len(d)
        elif ats == "ashby":
            d = _get("https://api.ashbyhq.com/posting-api/job-board/{}".format(token))
            if isinstance(d, dict) and isinstance(d.get("jobs"), list):
                return len(d["jobs"])
        elif ats == "smartrecruiters":
            d = _get("https://api.smartrecruiters.com/v1/companies/{}/postings?limit=10".format(token))
            if isinstance(d, dict) and isinstance(d.get("content"), list) and d["content"]:
                return d.get("totalFound") or len(d["content"])
        elif ats == "recruitee":
            d = _get("https://{}.recruitee.com/api/offers/".format(token))
            if isinstance(d, dict) and isinstance(d.get("offers"), list):
                return len(d["offers"])
        elif ats == "teamtailor":
            xml = _get_text("https://{}.teamtailor.com/jobs.rss".format(token))
            if xml and "<item>" in xml:
                return xml.count("<item>")
    except Exception:
        return 0
    return 0


# -----------------------------------------------------------------------------
# Resolve one company
# -----------------------------------------------------------------------------
def resolve_company(name, cache=None):
    """Return {name, ats, token, count, via}. ats/token are None if nothing
    resolved. One failure never raises."""
    # 1) Locked-in seeds always win (just confirm the live count).
    if name in SEED:
        ats, token = SEED[name]
        cnt = probe_count(ats, token)
        time.sleep(POLITE_DELAY)
        return {"name": name, "ats": ats, "token": token, "count": cnt, "via": "seed"}

    # 2) Cached answer (fast re-runs).
    if cache is not None and name in cache:
        return cache[name]

    # 3) Probe each ATS in the required order, first ats+token with >0 jobs wins.
    #    greenhouse/lever/ashby use the 3 name forms; smartrecruiters uses the
    #    CamelCase form; recruitee/teamtailor use lowercase subdomain forms.
    cands = candidate_tokens(name)
    subs = subdomain_tokens(name)
    attempts = [
        ("greenhouse", cands),
        ("lever", cands),
        ("ashby", cands),
        ("smartrecruiters", [camel_nospace(name)]),
        ("recruitee", subs),
        ("teamtailor", subs),
    ]

    result = {"name": name, "ats": None, "token": None, "count": 0, "via": "none"}
    for ats, toks in attempts:
        for tok in toks:
            if not tok:
                continue
            cnt = probe_count(ats, tok)
            time.sleep(POLITE_DELAY)
            if cnt > 0:
                result = {"name": name, "ats": ats, "token": tok,
                          "count": cnt, "via": "probe"}
                if cache is not None:
                    cache[name] = result
                return result

    if cache is not None:
        cache[name] = result
    return result


# -----------------------------------------------------------------------------
# Cache helpers
# -----------------------------------------------------------------------------
def load_cache():
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE) as f:
                return json.load(f)
        except Exception:
            return {}
    return {}


def save_cache(cache):
    with open(CACHE_FILE, "w") as f:
        json.dump(cache, f, indent=2)


# -----------------------------------------------------------------------------
# Resolve the whole list and rewrite companies.py
# -----------------------------------------------------------------------------
def write_companies_py(results, path="companies.py"):
    resolved = [r for r in results if r["ats"]]
    failed = [r for r in results if not r["ats"]]

    lines = []
    lines.append("# =============================================================================")
    lines.append("# COMPANIES — AUTO-GENERATED by resolver.py. Safe to edit by hand.")
    lines.append("#")
    lines.append("# Each entry: {\"name\": ..., \"ats\": ..., \"token\": ...}")
    lines.append("#   ats   = greenhouse | lever | ashby | smartrecruiters")
    lines.append("#   token = the company's public ID in that ATS.")
    lines.append("#")
    lines.append("# Companies the resolver could NOT place are commented out at the bottom so")
    lines.append("# you can see exactly what failed (private/unknown ATS, renamed token, etc.).")
    lines.append("# Re-run `python3 resolver.py` to refresh.")
    lines.append("# =============================================================================")
    lines.append("")
    lines.append("COMPANIES = [")
    for r in results:
        if r["ats"]:
            lines.append('    {{"name": {!r:<24}, "ats": {!r:<18}, "token": {!r}}},'.format(
                r["name"], r["ats"], r["token"]))
    lines.append("")
    lines.append("    # ---- Unresolved (no ATS returned jobs) ----")
    for r in failed:
        lines.append('    # {{"name": {!r:<24}, "ats": None, "token": None}},  # resolver: not found'.format(
            r["name"]))
    lines.append("]")
    lines.append("")

    with open(path, "w") as f:
        f.write("\n".join(lines))
    return len(resolved), len(failed)


def main():
    cache = load_cache()
    results = []
    n = len(COMPANY_NAMES)
    print("Resolving {} companies...\n".format(n))
    for i, name in enumerate(COMPANY_NAMES, 1):
        r = resolve_company(name, cache=cache)
        if r["ats"]:
            print("[{:>3}/{}] {:<22} -> {}:{} ({} jobs) [{}]".format(
                i, n, name, r["ats"], r["token"], r["count"], r["via"]))
        else:
            print("[{:>3}/{}] {:<22} -> UNRESOLVED".format(i, n, name))
        results.append(r)
        save_cache(cache)  # persist as we go, so a crash doesn't lose progress

    resolved, failed = write_companies_py(results)
    print("\nDone. {} resolved, {} unresolved. Wrote companies.py.".format(resolved, failed))


if __name__ == "__main__":
    main()
