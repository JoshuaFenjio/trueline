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
#   python3 resolver.py                 # resolve the list below, rewrite companies.py
#   python3 resolver.py --verify        # ALSO re-probe cached hits and drop dead ones
#   python3 resolver.py --workers 16    # probe N companies at once (default 10)
#   python3 resolver.py --retry-failed  # re-probe names cached as unresolvable
#
# Then run the pipeline as usual: python3 pipeline.py
# =============================================================================

import os
import re
import sys
import json
import time
import threading
from concurrent.futures import ThreadPoolExecutor

import requests

USER_AGENT = "TruelineJobsBot/1.0 (+salary-benchmarking; contact: jobs@trueline.local)"
HEADERS = {"User-Agent": USER_AGENT, "Accept": "application/json"}
PROBE_TIMEOUT = 6          # seconds per probe (kept short so dead boards fail fast)
POLITE_DELAY = 0.2         # pause between probes (within one company's sequence)
CACHE_FILE = ".resolver_cache.json"
DEFAULT_WORKERS = 10       # companies probed concurrently

# One Session per thread: connection pooling turns a ~14-probe sequence from 14
# TLS handshakes into 1, which is most of the speed-up at this list size.
_local = threading.local()


def _session():
    s = getattr(_local, "s", None)
    if s is None:
        s = requests.Session()
        s.headers.update(HEADERS)
        _local.s = s
    return s

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
    # --- ROUND 5 (scale: country sweeps + thin-country + sector gaps) -------
    # ~1,330 candidates. All 6 ATS types are probed per name; whatever answers
    # is kept, the rest are commented out at the bottom of companies.py.
    # United Kingdom (90)
    "Accurx", "Thriva", "Numan", "Peppy", "Unmind", "Healx", "Congenica",
    "CMR Surgical", "Lifebit", "Proximie", "Birdie", "DrDoctor",
    "Skin Analytics", "Brainomix", "Perspectum", "Synthace", "Push Doctor",
    "Axial3D", "Immersive Labs", "Red Sift", "Panaseer", "CultureAI",
    "Risk Ledger", "Metomic", "CybSafe", "Intruder", "SenseOn", "Ripjar",
    "PQShield", "Quorum Cyber", "Searchlight Cyber", "Elliptic", "Ravelin",
    "Zego", "Zeelo", "Beryl", "Citymapper", "Ohme", "Pod Point", "Zapmap",
    "Connected Kerb", "Oxa", "Zencargo", "Hived", "Packfleet", "Sorted",
    "Huboo", "Motorway", "Cuvva", "Skyports", "Thought Machine", "ClearBank",
    "Paddle", "Wagestream", "iwoca", "OakNorth", "Atom Bank", "Tractable",
    "V7", "Encord", "Mind Foundry", "Gearset", "Ably", "Snowplow",
    "Cloudsmith", "Riverlane", "Cognism", "Permutive", "Goodlord", "LandTech",
    "Orbital Witness", "Superscript", "hyperexponential", "YuLife", "Sona",
    "Multiverse", "Omnipresent", "Luminance", "Robin AI", "Lawhive",
    "Tripledot Studios", "Kwalee", "nDreams", "Kaluza", "Sylvera", "Zenobe",
    "ZeroAvia", "Butternut Box", "Bloom and Wild", "Olio",
    # Ireland (45)
    "Deciphex", "Wellola", "Oneview Healthcare", "Aerogen",
    "Neuromod Devices", "patientMpower", "Beats Medical", "Salaso",
    "Luminate Medical", "Perfuze", "Edgescan", "Vaultree", "Getvisibility",
    "Waratek", "Smarttech247", "Integrity360", "Nova Leah", "Daon", "Scurri",
    "CarTrawler", "Datalex", "Transpoco", "Luna Systems", "Zipp Mobility",
    "CitySwift", "Provizio", "XOCEAN", "Fexco", "Corlytics", "AQMetrics",
    "Know Your Customer", "Payslip", "Kota", "Brightflag", "Boundless",
    "Poppulo", "Xtremepush", "Cora Systems", "Glofox", "Bizimply", "Trustap",
    "GridBeyond", "Herdwatch", "Romero Games", "Nearform",
    # Germany (96)
    "Brainlab", "Caresyntax", "Aignostics", "Vara", "Deepc", "Mediaire",
    "Floy", "Climedo", "Temedica", "Kranus Health", "HelloBetter", "Recare",
    "Ottonova", "Tubulis", "Hornetsecurity", "SoSafe", "Myra Security",
    "Link11", "Utimaco", "IDnow", "Nect", "Build38", "Code Intelligence",
    "ONEKEY", "Enginsight", "Secfix", "Kertos", "Flix", "Fernride", "Vay",
    "Konux", "Quantum Systems", "Wingcopter", "Isar Aerospace", "Cargo.one",
    "InstaFreight", "Container xChange", "Everstox", "FINN", "Dance",
    "Vialytics", "Magazino", "Arculus", "Moss", "Billie", "Mondu", "Payrails",
    "Upvest", "Ivy", "Lucanet", "Candis", "Tomorrow", "Wefox", "Getsafe",
    "Clark", "Element", "Thinksurance", "Casavi", "Alasco", "Cosuno", "Capmo",
    "Building Radar", "1Komma5", "Enpal", "Zolar", "Ostrom", "Sunfire",
    "Instagrid", "Cylib", "Tanso", "Marvel Fusion", "Proxima Fusion",
    "Ineratec", "Zenjob", "Kenjo", "Workmotion", "Localyze", "CoachHub",
    "StudySmarter", "Babbel", "Jina AI", "Ory", "Kubermatic", "Nextcloud",
    "Cognigy", "Scoutbee", "Agile Robots", "Neura Robotics", "Sereact",
    "Robco", "Franka Robotics", "Kinexon", "Bryter", "Grover", "Wunderflats",
    "Urban Sports Club",
    # Switzerland (thin-country priority) (72)
    "Mindmaze", "Aktiia", "Oviva", "Lunaphore", "Nanoflex Robotics",
    "Resistell", "Genedata", "InSphero", "Nanolive", "SmartCardia",
    "Positrigo", "Xsensio", "Medartis", "Hocoma", "Memo Therapeutics",
    "Alentis Therapeutics", "Open Systems", "Exeon", "Anapaya", "Xorlab",
    "Futurae", "Decentriq", "Threema", "Adnovum", "Nevis", "ID Quantique",
    "Prodaft", "InfoGuard", "Terra Quantum", "Wingtra", "Auterion", "Verity",
    "Flyability", "Anybotics", "RIVR", "Sevensense", "Daedalean",
    "Dufour Aerospace", "Loxo", "Embotech", "Fixposition", "Carvolution",
    "Voliro", "Neon", "Alpian", "Teylor", "Relai", "Bitcoin Suisse", "Taurus",
    "Nym", "True Wealth", "Numarics", "Smallpdf", "Doodle", "Skribble",
    "Onedot", "Klara", "Sportradar", "PriceHubble", "Allthings", "Flatfox",
    "Energy Vault", "Synhelion", "DePoly", "Ecorobotix", "Bcomp", "Astrocast",
    "ClearSpace", "Corintis", "Sensirion", "Xovis", "Simpego",
    # Austria (thin-country priority) (66)
    "Symptoma", "contextflow", "ImageBiopsy Lab", "Piur Imaging",
    "Medicus AI", "Nyra Health", "Xund", "Lexogen", "Proxygen",
    "Quantro Therapeutics", "Innophore", "MED-EL", "Ares Genetics",
    "Cyprumed", "Medaia", "Marinomed", "Cybertrap",
    "IKARUS Security Software", "Nimbusec", "Lywand", "Cryptas", "A-Trust",
    "XiTrust", "Anexia", "RadarServices", "SBA Research", "Kontrol",
    "emotion3D", "Easelink", "go-e", "Aviloo", "Agilox", "Enpulsion",
    "Peak Technology", "Blue Danube Robotics", "Fluidtime", "Payuca",
    "ummadum", "Froots", "Finmatics", "Morpher", "Riskine", "Bsurance",
    "Rendity", "Dynatrace", "Tricentis", "Cloudflight", "Netconomy",
    "Mostly AI", "Craftworks", "Meister", "Copa-Data", "Onlim",
    "Leftshift One", "Sproof", "Ubimet", "Fabasoft", "Tractive", "Woom",
    "Studo", "Revo Foods", "Arkeon Biotechnologies", "Neoom", "Enspired",
    "Loxone", "Eversports",
    # France (96)
    "Lifen", "Withings", "Gleamer", "Incepto", "Therapixel", "Implicity",
    "Dental Monitoring", "Diabeloop", "Aqemia", "Iktos", "Synapse Medicine",
    "Resilience", "Volta Medical", "Quantum Surgical", "Sonio", "BioSerenity",
    "Wandercraft", "Tehtris", "HarfangLab", "Vade", "Filigran", "Wallix",
    "YesWeHack", "Yogosha", "DataDome", "Quarkslab", "Pradeo", "Escape",
    "Egerie", "Glimps", "Trustpair", "Olvid", "Riot", "Vulog", "Karos",
    "Vianova", "Padam Mobility", "Getaround", "Virtuo", "Yespark", "Electra",
    "Zeplug", "Verkor", "EasyMile", "Shippeo", "Ovrsea", "Cubyn", "Colisweb",
    "Exotec", "Fifteen", "WeMaintain", "Boxtal", "Shippingbo", "Younited",
    "October", "Mooncard", "Fintecture", "Powens", "Lemonway", "Akur8",
    "Zelros", "Seyna", "Orus", "Lucca", "JobTeaser", "Welcome to the Jungle",
    "Side", "Clever Cloud", "Scalingo", "Kestra", "Deepomatic",
    "Illuin Technology", "Greenly", "Sweep", "Deepki", "Lhyfe", "Sencrop",
    "Matera", "Garantme", "Malt", "Selency", "Jow", "Ornikar", "Zenchef",
    "Sunday", "Doctrine", "Predictice", "Tomorro", "Exotrail", "Unseenlabs",
    "Kinéis", "Akeneo", "Brevo", "Ringover", "Didomi", "Toucan Toco",
    # Netherlands (69)
    "Pacmed", "Aidence", "Thirona", "ScreenPoint Medical", "Luscii",
    "Momo Medical", "Salvia BioElectronics", "Onera Health", "LUMICKS",
    "Castor", "ZorgDomein", "Mimetas", "ProQR", "VectorY", "Xeltis",
    "Preceyes", "Sirius Medical", "Orikami", "ThreatFabric", "Hadrian",
    "Eye Security", "Secura", "Riscure", "Onegini", "Zerocopter", "Northwave",
    "Tesorion", "Computest", "Roseman Labs", "Shypple", "Quicargo",
    "MyWheels", "SnappCar", "Felyx", "Swapfiets", "Fastned", "Allego",
    "Jedlix", "Paazl", "Trunkrs", "Prime Vision", "Fizyr", "Rocsys",
    "Vinturas", "Ohpen", "Buckaroo", "Payaut", "Bitvavo", "Klippa", "Mendix",
    "Betty Blocks", "AFAS Software", "CM.com", "Spotler", "Deeploy",
    "TestGorilla", "Homerun", "Equalture", "Effectory", "Sympower",
    "GreenFlux", "Sensorfact", "Physee", "Meatable", "Protix", "ISISpace",
    "Dawn Aerospace", "Demcon", "SkinVision",
    # Belgium (52)
    "icometrix", "FEops", "Indigo Diabetes", "Nyxoah", "Byteflies", "moveUP",
    "Andaman7", "Comunicare Solutions", "FibriCheck", "Lynxcare", "BioLizard",
    "Bingli", "MintT", "Spentys", "Radiomics", "Rejuvenate Biomed",
    "Biotalys", "Univercells", "Confo Therapeutics", "NVISO", "Toreon",
    "Approach Cyber", "Davinsi Labs", "Phished", "Ceeyu", "Harmoney",
    "Urbantz", "Skipr", "Optimile", "Bringme", "BePark", "Commuty", "Poppy",
    "Be-Mobile", "Nallian", "Ovinto", "Septentrio", "Isabel Group",
    "Cashforce", "Twikey", "Digiteal", "Penbox", "Monizze", "Rydoo",
    "Aion Bank", "Aerospacelab", "Space Applications Services", "Officient",
    "Apicbase", "Bizzy", "Codit", "NGDATA",
    # Sweden (68)
    "Min Doktor", "Doctrin", "Visiba Care", "Cambio Healthcare Systems",
    "Sectra", "Werlabs", "Coala Life", "Flow Neuroscience", "Natural Cycles",
    "Lifesum", "Cellink", "Bonesupport", "Tandem Health", "Yubico",
    "Outpost24", "Clavister", "Advenica", "Truesec", "Nexus Group",
    "Combitech", "Zenseact", "Candela", "X Shore", "Airmee", "Nira Dynamics",
    "CEVT", "Icomera", "Ingrid", "nShift", "Zimpler", "Brite Payments",
    "Qred", "Froda", "Rocker", "Lysa", "Treyd", "Zaver", "Hedvig", "Insurely",
    "Teamtailor", "Winningtemp", "Alva Labs", "Jobylon", "Benify", "Eletive",
    "Lime Technologies", "Upsales", "GetAccept", "Oneflow", "Funnel",
    "Centra", "Stravito", "Aira", "Svea Solar", "Stegra", "ClimateView",
    "Doconomy", "Hemnet", "Qasa", "Storytel", "Soundtrack Your Brand",
    "Paradox Interactive", "Avalanche Studios", "Sharkmob", "Netlight",
    "tretton37", "Nexer", "Consid",
    # Denmark (thin-country priority) (58)
    "Cerebriu", "Radiobotics", "Monsenso", "Liva Healthcare", "Cortrium",
    "Hedia", "Teton", "BrainCapture", "Enversion", "Evaxion Biotech",
    "Systematic", "Trifork", "Logpoint", "Heimdal", "CSIS Security Group",
    "Keepit", "Uniqkey", "Improsec", "Dubex", "Muninn", "CyberPilot",
    "Milestone Systems", "Donkey Republic", "Spirii", "Clever", "ZeroNorth",
    "Portchain", "GateHouse Maritime", "Shipmondo", "Coolrunner", "AutoUncle",
    "MapsPeople", "Mobile Industrial Robots", "Sky-Watch", "Clearhaus",
    "OnPay", "Subaio", "Likvido", "Anyday", "Penni", "Universal Robots",
    "OnRobot", "Nordbo Robotics", "Agrointelli", "European Energy",
    "Better Energy", "Blue World Technologies", "Umbraco", "Plecto", "Adform",
    "Raffle", "Configit", "Trackman", "Worksome", "Vivino", "Labster",
    "Monstarlab", "Charlie Tango",
    # Norway (54)
    "DIPS", "Dignio", "Sensio", "CheckWare", "Diffia", "Vitalthings",
    "Aidee Health", "Ledidi", "Eyr", "Nordic Brain Tech", "Laerdal Medical",
    "mnemonic", "Promon", "Signicat", "Netsecurity", "Defendable", "Watchcom",
    "Zeabuz", "Hyre", "Ryde", "Porterbuddy", "Entur", "Fara",
    "Applied Autonomy", "Easee", "Zaptec", "Corvus Energy", "Maritime Optima",
    "Dintero", "Settle", "Folio", "Aprila Bank", "Zwipe", "Horde",
    "PowerOffice", "FundingPartner", "reMarkable", "Vivaldi Technologies",
    "Milient Software", "Simployer", "Talentech", "Highsoft", "Vizrt",
    "Cavai", "Opera", "Volue", "Morrow Batteries", "Hystar", "Bekk", "Bouvet",
    "Variant", "Miles", "Funcom", "Dirtybit",
    # Finland (54)
    "Nightingale Health", "Aiforia", "BC Platforms", "Buddy Healthcare",
    "Meru Health", "Nanoform", "Optomed", "Revenio", "Sooma",
    "Neuro Event Labs", "Cerenion", "WithSecure", "F-Secure",
    "SSH Communications Security", "Nixu", "Fraktal", "Xiphera", "Tosibox",
    "Insta", "Badrap", "Virta", "Kempower", "Norsepower", "Awake.AI",
    "Groke Technologies", "Unikie", "Sensible 4", "Logmore", "MaaS Global",
    "Roadscanners", "Valohai", "IQM Quantum Computers", "Bluefors",
    "Dispelix", "Kuva Space", "Haltian", "M-Files", "Efecte", "Vainu",
    "Dealfront", "Giosg", "Frosmo", "Nosto", "Holvi", "Multitude", "Sympa",
    "Talenom", "Futurice", "Vincit", "Gofore", "Siili Solutions",
    "Remedy Entertainment", "Small Giant Games", "Fingersoft",
    # Spain (72)
    "Paradigma Digital", "Wetaca", "Signaturit", "Idoven", "MedicSen",
    "Legit Health", "Mediktor", "Savana", "Universal Doctor", "Tucuvi",
    "Bloomfield Therapeutics", "Made of Genes", "Psious", "Doctoralia",
    "Docline", "Ability Pharma", "Oncoheroes", "Bioncotech", "Health in Code",
    "Methinks AI", "Mitiga Solutions", "Buguroo", "Countercraft", "S2 Grupo",
    "Enthec", "Alias Robotics", "Tarlogic", "Zerolynx", "Lucus Data",
    "Gradiant", "Open Cloud Factory", "Smart Protection", "Nemuru", "Usyncro",
    "Trucksters", "Zeleros", "Shipeu", "Voltio", "Reby", "Cooltra", "Muving",
    "Ecooltra", "Cuideo", "Aplazame", "Payflow", "Pecunpay", "Belvo", "Verse",
    "Coinscrap", "Unnax", "Flanks", "Embat", "Sesame HR", "Gohub", "Jeff",
    "Holded", "Quipu", "Declarando", "Cuéntica", "Woffu", "Barkibu",
    "Vinissimus", "Marfeel", "Camaloon", "Wallapop", "Colvin", "Quibim",
    "Koa Health", "Mediquo", "Universal DX", "Ironchip", "IriusRisk",
    # Italy (45)
    "Empatica", "Paginemediche", "Healthware", "Elty", "Santagostino",
    "Miodottore", "Sibylla Biotech", "Genenta Science",
    "Medical Microinstruments", "Nurse24", "Cyber Guru", "Yarix", "Certego",
    "Swascan", "Aizoon", "Ermes Cyber Security", "Cyberoo", "Gyala", "Telsy",
    "Wetaxi", "Helbiz", "Movyon", "Trucky", "BeCharge", "Silla Industries",
    "Nozomi Networks", "Wallife", "Qomodo", "Fido", "Workinvoice",
    "BorsadelCredito", "Modefinance", "Sardex", "Tot", "Hype", "Beesy",
    "Cubbit", "Radicalbit", "Fluentify", "Chili", "Velasca", "IT-Auction",
    "Arduino", "Chino.io", "Diaman Tech",
    # Portugal (39)
    "Knok Healthcare", "Tonic App", "Medicinae", "GenoMed", "Promptly Health",
    "iLoF", "Ophiomics", "Stemmatters", "Neuroinova", "BioSurfit", "Peekmed",
    "Follow Health", "Clynx", "Xarevision", "Anubis Networks",
    "Layer8 Security", "Integrity", "VisionWare", "Loqr", "Vawlt", "Ubiwhere",
    "CEiiA", "Ridefy", "Cloudfleet", "Frotcom", "Zaask", "Movvo", "Rows",
    "Bliss Applications", "Whitesmith", "Runtime Revolution", "Subvisual",
    "Doist", "James", "Zerozero", "E-goi", "Jumpseller", "Prozis",
    "Landing Jobs",
    # Poland (68)
    "Nozbe", "LiveChat", "Autenti", "Zenbox", "Sotrender", "Netguru",
    "STX Next", "SoftwareMill", "Divante", "Espeo Software", "Miquido",
    "Boldare", "10Clouds", "Spyrosoft", "Future Processing", "Britenet",
    "Solwit", "Transition Technologies", "Comarch", "Ailleron", "CD Projekt",
    "Techland", "11 bit studios", "People Can Fly", "Bloober Team",
    "Huuuge Games", "Ten Square Games", "Vivid Games", "Creepy Jar",
    "The Farm 51", "Fool's Theory", "PayU", "Autopay", "Blue Media", "Tpay",
    "eSky", "Emitwise", "Placeme", "CargoON", "Trans.eu", "SpaceOS", "Sente",
    "BaseLinker", "Apilo", "Edrone", "Salesmanago", "Synerise", "DevSkiller",
    "Traffit", "Grape Up", "Codete", "Neurosoft", "StethoMe", "Telemedico",
    "Cardiomatics", "Genomtec", "Saventic Health", "Medicalgorithmics",
    "Upmedic", "SecureVisio", "Seqred", "CyberusLabs", "Cypherdog",
    "Xopero Software", "Whitepress", "Creotech Instruments", "SatRevolution",
    "Scanway",
    # Czechia (52)
    "Cognitive Security", "Socialbakers", "Bileto", "Dodo", "Liftago",
    "Shipmonk", "Zásilkovna", "Slevomat", "Reservio", "Tanganica", "Shoptet",
    "Upgates", "Dateio", "Portu", "Fondee", "Roger", "Wultra", "Mallpay",
    "Zonky", "Bohemia Interactive", "Warhorse Studios", "SCS Software",
    "Amanita Design", "Madfinger Games", "Charles Games", "Beat Games",
    "Ackee", "STRV", "Cleverlance", "Etnetera", "Unicorn Systems", "Y Soft",
    "Kentico", "Xitee", "Whalebone", "Avast Software", "Cybergym", "Nettle",
    "Cyber Rangers", "Trask Solutions", "Adastra", "Datamole", "DataSentics",
    "Blindspot Solutions", "Neuron Soundware", "Carebot", "Aireen", "Enehano",
    "Cleerio", "Spaceti", "Flowbox", "Semantic Visions",
    # Romania (40)
    "Emag", "Vola", "Elefant", "Safefleet", "Blue Point", "Clever Taxi",
    "Docbook", "MedicHub", "Telios Care", "Xvision", "Digitail", "Medicai",
    "Cyberswarm", "Cyber Smart Defence", "Certsign", "Safetech Innovations",
    "Dekeneas", "Cyscale", "Zitec", "Fortech", "Yonder", "Pentalog", "Arobs",
    "Bytex", "3Pillar Global", "Accesa", "Grapefruit", "Codespring",
    "Halcyon Mobile", "Amber Studio", "Green Horse Games", "Ezugi",
    "Vector Watch", "Smart Bill", "Modex", "Thecon", "SmartDreamers",
    "Aqurate", "Kubo", "Beez",
    # Lithuania (38)
    "Kilo Health", "CGTrader", "Trafi", "Interactio", "Oxylabs", "Whatagraph",
    "Eneba", "Ondato", "Nexpay", "Kevin", "TransferGo", "Paysera", "Genome",
    "ConnectPay", "Bankera", "Devbridge", "Baltic Amadeus", "Blue Bridge",
    "NRD Cybersecurity", "Cujo AI", "Surfshark", "Tesonet", "Wallter",
    "Debifo", "Ovoko", "Aciety", "Hostinger", "Heavy Finance", "Amlyze",
    "Biomatter", "Diagnolita", "Ligence", "Oxipit", "Vugene", "Femtika",
    "Astrolight", "Nanoavionics", "Elsis",
    # Estonia (42)
    "Starship Technologies", "Comodule", "Modularbank", "Tuum", "Wallester",
    "Grabcad", "Fortumo", "Cybernetica", "Guardtime", "RangeForce",
    "Clarified Security", "CybExer Technologies", "Sixfold", "Timbeter",
    "Skeleton Technologies", "Katana", "Klaus", "Zelos", "Fractory", "Xolo",
    "Jobbatical", "Testlio", "Plumbr", "Toggl", "Monese", "Change Invest",
    "Funderbeam", "Investly", "Bondora", "Coinmetro", "Uptime", "Icefire",
    "Nortal", "Helmes", "Net Group", "Proekspert", "Mooncascade", "Thorgate",
    "Antegenes", "Migrevention", "Triumf Health", "Sportlyzer",
    # sector gap-fill - Health (28)
    "Babylon Health", "Elvie", "Clue", "Selfapy", "Medbelle", "Vivy",
    "Medneo", "Mecuris", "Implantcast", "Xbird", "Cardiologs", "Amboss",
    "Siilo", "Nedap Healthcare", "Hinge Health", "Quin", "BoneProx", "Popit",
    "Disior", "Corvus Health", "Prescriby", "Sundhed", "Higo",
    "Kelvin Health", "Vitalink", "Docly", "FundamentalVR", "MedApp",
    # sector gap-fill - Security (41)
    "Sophos", "Egress", "Tessian", "Garrison Technology", "Exabeam",
    "Salt Security", "Cato Networks", "Cyberint", "Cybereason", "Claroty",
    "Armis", "Axonius", "Cymulate", "Silverfort", "Perimeter81",
    "Orca Security", "Wiz", "Aqua Security", "Cyera", "Grip Security",
    "Noname Security", "BigID", "Transmit Security", "Pentera", "CYE",
    "Bright Security", "Vulcan Cyber", "Threatray", "Terra Security",
    "CrowdSec", "Secfense", "Nordlayer", "Cyberpion", "CyberSmart",
    "Immunefi", "Cipher", "Cyberwatch", "Escape Technology", "Elba Security",
    "Cyberprotect", "Criipto",
    # sector gap-fill - Mobility / logistics (42)
    "Zipabout", "Masabi", "Ridecell", "Bytemark", "Fleetondemand", "Kinaxia",
    "Beacon Technologies", "Nuvocargo", "Everoad", "Cargonexx", "Evertracker",
    "Cargoboard", "Saloodo", "Nedcargo", "Innight", "Sedna", "ShipHawk",
    "Napa", "Fintraffic", "Klaravik", "Bzzt", "Nabobil", "Optibus", "Moovit",
    "Hailo", "Via Transportation", "Autofleet", "Bringg", "Fabric Robotics",
    "Parkbob", "Swarco", "Bikemap", "Frogne", "Fluctuo", "Cityscoot",
    "Marcel", "Ecov", "Zeway", "Wattpark", "Mob Energy", "Driveco", "Tiqets",

    # --- ROUND 6 (scale: under-covered markets + big-market depth + sectors) --
    # ~1,050 candidates: 12 markets the earlier rounds never swept, Israel/Gulf/
    # Turkey, a second pass at UK+DE, and five more cross-EMEA sector sweeps.
    # Hungary (39)
    "Bitrise", "Tresorit", "Craft Docs", "Barion", "Shapr3D", "SEON",
    "Turbine.ai", "AImotive", "Commsignia", "Cursor Insight", "Supercharge",
    "Starschema", "NNG", "Graphisoft", "BlackBelt Technology", "Cheppers",
    "Antavo", "Codecool", "Ergomania", "OptiMonk", "Recart", "Bookr Kids",
    "Xeropan", "LogiNet", "Attrecto", "Finshape", "Cellum", "Dorsum",
    "Adaptive Recognition", "Digital Natives", "Nexogen", "Microsec",
    "Oncompass Medicine", "Mediso", "Talk-A-Bot", "Zen Studios",
    "NeocoreGames", "Invictus Games", "Nemesys Games",
    # Greece (44)
    "Blueground", "Skroutz", "Workable", "Viva.com", "Netdata",
    "Hellas Direct", "Welcome Pickups", "Orfium", "Advantis Medical Imaging",
    "BioAssist", "DeepSea Technologies", "Harbor Lab", "MarineTraffic",
    "Convert Group", "Epignosis", "Yodeck", "Entersoft", "SoftOne",
    "Epsilon Net", "Profile Software", "Uni Systems",
    "Performance Technologies", "Upstream", "Warply", "Think Silicon",
    "Irida Labs", "Ferryhopper", "Kaizen Gaming", "Novibet", "Emtech Space",
    "AgroApps", "Augmenta", "Pobuca", "Cyclopt", "Code4Thought", "Vidavo",
    "Tekmon", "Douleutaras", "InstaCar", "Spitogatos", "Obrela",
    "Census Labs", "Natech", "Qualco",
    # Ukraine (56)
    "SoftServe", "Ciklum", "Intellias", "N-iX", "ELEKS", "Sigma Software",
    "Infopulse", "Miratech", "Innovecs", "Yalantis", "MobiDev", "Binariks",
    "TechMagic", "SPD Technology", "Softjourn", "Beetroot", "Redwerk",
    "Program-Ace", "WEZOM", "Grammarly", "Preply", "Genesis", "Headway",
    "BetterMe", "Promova", "OBRIO", "Solidgate", "Fintech Farm", "Monobank",
    "Mate academy", "Laba", "Jooble", "Rozetka", "EVO", "Nova Poshta",
    "Uklon", "Ajax Systems", "Petcube", "Reface", "Restream", "Respeecher",
    "Competera", "YouScan", "Awesomic", "Deus Robotics", "Zibra AI", "Liki24",
    "Esper Bionics", "GSC Game World", "Frogwares", "Boosteroid", "Hacken",
    "UnderDefense", "Cossack Labs", "Osavul", "Delfast",
    # Latvia (30)
    "Printful", "Printify", "Lokalise", "Mintos", "Twino", "Creamfinance",
    "4finance", "Sun Finance", "Eleving Group", "Jeff App", "Giraffe360",
    "Naco Technologies", "LightSpace Technologies", "Anatomy Next",
    "Longenesis", "Cellbox Labs", "CastPrint", "Edurio", "Sonarworks",
    "Tilde", "Draugiem Group", "TestDevLab", "SAF Tehnika", "MikroTik",
    "Airdog", "WeAreDots", "Squalio", "AskRobin", "Indexo", "Zabbix",
    # Slovakia (30)
    "ESET", "Sygic", "Photoneo", "Slido", "Pixel Federation", "Vacuumlabs",
    "GA Drilling", "Sensoneo", "Kontentino", "Staffino", "Nicereply",
    "Websupport", "Innovatrics", "Tachyum", "AeroMobil", "MultiplexDX",
    "Powerful Medical", "Instarea", "Softec", "Anasoft",
    "Gratex International", "Resco", "Ecocapsule", "Wezeo", "Martinus",
    "Sudolabs", "Luigis Box", "GymBeam", "Boataround", "Fumbi",
    # Slovenia (23)
    "Outfit7", "Bitstamp", "Celtra", "Databox", "GoOpti", "Cosylab",
    "Optiweb", "Marand", "Chipolo", "Genialis", "Comtrade", "Halcom",
    "Dewesoft", "Pipistrel", "Elaphe", "NiceLabel", "XLAB", "Bird Buddy",
    "Sunesis", "Metrel", "Robotina", "Smart Optometry", "Nervtech",
    # Croatia (35)
    "Infobip", "Rimac Technology", "Photomath", "Verne", "Nanobit",
    "Gamepires", "Croteam", "Lemax", "Agrivi", "Gideon Brothers", "Bellabeat",
    "Repsly", "Farseer", "Oradian", "Aircash", "Electrocoin", "Mindsmiths",
    "Undabot", "Q agency", "Span", "King ICT", "Amodo", "CircuitMess",
    "Greyp", "Microblink", "Sofascore", "Degordian", "Serengeti",
    "Ars Futura", "Profico", "Locastic", "Orqa", "Mobilisis",
    "Amphinicy Technologies", "Diverto",
    # Bulgaria (40)
    "Quantive", "Chaos", "Ontotext", "Sirma", "Dronamics", "EnduroSat",
    "NitroPack", "AMPECO", "CloudCart", "Bianor", "Musala Soft", "Sciant",
    "Scalefocus", "Dreamix", "Software Group", "Haemimont Games",
    "Snapshot Games", "Imperia Online", "Amusnet", "Phyre", "iCard",
    "Paynetics", "SoftUni", "SuperHosting", "Sensika", "LogSentinel",
    "AMATAS", "Healee", "Speedy", "Econt", "Nexo", "Modeshift", "Biodit",
    "Allterco", "SiteGround", "Telelink", "Transmetrics", "Metrilo",
    "Identrics", "Pontica Solutions",
    # Serbia (31)
    "Nordeus", "HTEC Group", "Vega IT", "Devtech", "Symphony",
    "Quantox Technology", "Execom", "Tenderly", "SmartCat", "Things Solver",
    "Superadmins", "Zesium", "Mad Head Games", "Eipix", "Digital Arrow",
    "Two Desperados", "3Lateral", "Peaksel", "FishingBooker",
    "Wireless Media", "Heliant", "CarGo", "Ananas", "Limundo",
    "KupujemProdajem", "Infostud", "Bild Studio", "Vivify Ideas", "Bitgear",
    "PSTech", "Strawberry Energy",
    # Luxembourg (25)
    "Talkwalker", "Byborg Enterprises", "Gcore", "Mangopay", "Payconiq",
    "Finologee", "Investify", "LuxTrust", "Tokeny", "Scorechain", "Salonkee",
    "Doctena", "Motion-S", "Zortify", "Passbolt", "Excellium Services",
    "Itrust Consulting", "LuxProvide", "OQ Technology", "Hydrosat",
    "LuxSpace", "Arspectra", "EmailTree", "Datathings", "Olamobile",
    # Iceland (23)
    "CCP Games", "Meniga", "Controlant", "Sidekick Health", "Kerecis",
    "Nox Medical", "Össur", "Marel", "Valka", "Dohop", "Teatime Games",
    "Solid Clouds", "Lucinity", "GreenBytes", "Carbfix", "Atmonia", "Advania",
    "Origo", "Tempo", "Men and Mice", "Syndis", "Aldin Dynamics",
    "Kara Connect",
    # South Africa (50)
    "Yoco", "Ozow", "Peach Payments", "Stitch", "Mama Money", "JUMO",
    "TymeBank", "Lula", "EasyEquities", "Luno", "VALR", "Entersekt",
    "SnapScan", "iKhokha", "Clickatell", "Prodigy Finance", "PayProp",
    "Naked", "Pineapple", "Root", "SweepSouth", "OfferZen", "Skynamo",
    "Aerobotics", "DataProphet", "Cartrack", "MiX Telematics", "Picup",
    "Takealot", "LifeQ", "Quro Medical", "Vula Mobile", "Healthforce",
    "Snode Technologies", "Performanta", "Xneelo", "Afrihost", "Teraco",
    "Entelect", "BBD", "DVT", "Synthesis", "Free Lives", "Sea Monster",
    "Dragonfly Aerospace", "CubeSpace", "GoSolr", "PaySpace", "Kandua",
    "JobJack",
    # Israel (110)
    "Torq", "Coralogix", "Logz.io", "Redis", "Aporia", "Deci", "AI21 Labs",
    "Anodot", "Explorium", "Rivery", "Firebolt", "Imubit", "Bizzabo", "Yotpo",
    "WalkMe", "Lusha", "Nexite", "Verbit", "Sisense", "SundaySky", "Kaltura",
    "Taboola", "Outbrain", "Playtika", "Moon Active", "Plarium", "SciPlay",
    "Lightricks", "Wix", "Fiverr", "Payoneer", "Tipalti", "Forter",
    "BlueVine", "Lemonade", "Kryon", "Nayax", "Nuvei", "eToro", "Pagaya",
    "Personetics", "Trigo", "Innoviz", "Mobileye", "REE Automotive",
    "Arbe Robotics", "Foretellix", "Otonomo", "Cognata", "Nexar", "Guardknox",
    "Upstream Security", "Karamba Security", "Cellebrite", "CyberArk",
    "Radware", "Imperva", "Varonis", "SentinelOne", "Deep Instinct",
    "Guardicore", "Ermetic", "Coro", "Cynet", "Intezer", "Panorays",
    "SafeBreach", "Sygnia", "Semperis", "Sweet Security", "Dazz",
    "Talon Cyber Security", "Descope", "Frontegg", "Reco", "Nagomi Security",
    "Seemplicity", "Legit Security", "Apiiro", "Oxeye", "Spectral", "Aidoc",
    "Nanox", "Ibex Medical Analytics", "DiA Imaging Analysis", "Viz.ai",
    "K Health", "Sight Diagnostics", "InSightec", "CartiHeal", "Vayyar",
    "Itamar Medical", "Belong.Life", "TytoCare", "Datos Health", "Sweetch",
    "Diagnostic Robotics", "Medial EarlySign", "Healthy.io", "Navina", "Hyro",
    "Prospera", "Taranis", "BeeHero", "Aleph Farms", "Remilk", "Tastewise",
    "Gloat", "Comeet", "HiredScore",
    # UAE / Gulf (45)
    "Swvl", "Yalla", "Anghami", "Bayut", "Dubizzle", "Namshi", "Noon",
    "Tamara", "Hala", "Foodics", "Unifonic", "Jahez", "Nana", "Zid", "Salla",
    "Cequens", "Trukker", "Postpay", "Baraka", "Ziina", "Pemo", "Qashio",
    "Wio Bank", "Mamo", "Stake", "Nomo", "Mrsool", "Floward", "Cartlow",
    "ClearGrid", "Yodawy", "Altibbi", "Vezeeta", "Okadoc", "Klaim", "Hakbah",
    "Rain", "CoinMENA", "BitOasis", "Astra Tech", "Money Fellows", "Sary",
    "Nybl", "Beehive", "Zbooni",
    # Turkey (39)
    "Trendyol", "Insider", "Hepsiburada", "Yemeksepeti", "Papara", "Iyzico",
    "Param", "Colendi", "Midas", "Figopara", "Craftgate", "Multinet",
    "Vispera", "Sipay", "Roketsan", "Baykar", "Bitci", "Paribu", "BTCTurk",
    "Icrypex", "Marti", "Scotty", "Tazi AI", "Segmentify", "Related Digital",
    "Bilyoner", "Nesine", "Modanisa", "Armut", "Sahibinden", "Enuygun",
    "Obilet", "Bulutistan", "Testinium", "V-Count", "Spyke Games",
    "Ruby Games", "Bigger Games", "Panteon Games",
    # United Kingdom - second pass (73)
    "Peak AI", "CloudNC", "Fluidly", "Cytora", "FundApps", "Codeplay",
    "Fractile", "Nu Quantum", "Geospock", "Audio Analytic", "Arqit",
    "Bought By Many", "Urban Jungle", "By Miles", "Chip", "Fronted",
    "Anthemis", "Trussle", "Coadjute", "Realyse", "Yoti", "Cifas", "Titania",
    "Glasswall", "Attio", "Legl", "Lexoo", "Century Tech", "Firefly Learning",
    "Sparx", "Twinkl", "Bibliu", "Kortext", "Doctorlink", "Medopad",
    "Optibrium", "Exscientia", "Antiverse", "LabGenius",
    "Small Robot Company", "Dogtooth", "Antobot", "Agrimetrics", "Oxbotica",
    "Five AI", "Vantage Power", "Naked Energy", "Brill Power", "Levidian",
    "Mixergy", "Sero", "Tumbling Games", "Cloud Imperium", "Ninja Theory",
    "Media Molecule", "Jagex", "TT Games", "Codemasters", "Rockstar North",
    "Outplay Entertainment", "4J Studios", "Sports Interactive",
    "Fusion Antibodies", "Kainos", "Datactics", "Cirdan", "B-Secur",
    "Locate a Locum", "AstroAgency", "Skyrora", "Orbex", "Open Cosmos",
    "Satellite Vu",
    # Germany - second pass (71)
    "Signavio", "Retorio", "Tado", "Exporo", "Vantik", "Elinvar", "Penta",
    "Fincompare", "Compeon", "Element Insurance", "Alteos", "Simplesurance",
    "Mika Health", "Preventicus", "Nyonic", "Ellamind", "Lengoo", "Sastrify",
    "Zeitgold", "Jobufo", "Talentwunder", "Sdui", "Simpleclub", "Cornelsen",
    "Edurino", "Bettermarks", "Knowunity", "Cybus", "Iotos", "Motius",
    "Cluno", "Streetscooter", "E.Go Mobile", "Envelio", "Gridx", "Kiwigrid",
    "Voltstorage", "Sono Motors", "Cambrium", "Mynaric", "Constellr",
    "Ororatech", "Kleos", "Vsparticle", "Understand AI", "Init", "Inovex",
    "Andrena Objects", "Sipgate", "Yatta Solutions", "Codecentric", "Innoq",
    "Adorsys", "Crossmedia", "Yoc", "Adtriba", "Adjust", "Remerge", "Fyber",
    "Applike", "Wandelbots", "Kinemic", "Ubermetrics", "Uberall", "Talon One",
    "Kontist", "Solvemate", "Userlike", "Trbo", "Fraugster", "Risk Ident",
    # sector - climate / energy (83)
    "Sunhero", "Ecoligo", "Enviria", "Solarnative", "Cloover", "Solmate",
    "Solytic", "Node Energy", "Entrix", "Suena", "Enerkite", "Turbit",
    "Aerones", "Gridcog", "Kraken Technologies", "Axle Energy", "Piclo",
    "Modo Energy", "Elum Energy", "Enode", "Flower", "Dexter Energy",
    "Withthegrid", "FlexiDAO", "Voltalis", "Ampeers Energy", "Elvah",
    "Plugsurfing", "Charge Amps", "Mer", "Powerdot", "Bump", "Freshmile",
    "Voltfang", "Green Li-ion", "Northstar Batteries", "Cellforce",
    "Basquevolt", "Nyobolt", "Altilium", "Plan A", "Cozero", "Coolset",
    "Altruistiq", "Carbmee", "Klimate", "Puro Earth", "Carbonfuture",
    "Mission Zero Technologies", "Skytree", "RepAir", "Thermondo", "Effy",
    "Sunamp", "Kensa", "Ecoworks", "Hysata", "HydrogenPro", "Everfuel",
    "Elcogen", "Green Hydrogen Systems", "Enapter", "Formo", "Mosa Meat",
    "Onego Bio", "Solar Foods", "Enough", "Ivy Farm Technologies",
    "Bosque Foods", "Redefine Meat", "Wilder Land", "Sojo", "Circulor",
    "Bower", "Recycleye", "Greyparrot", "Winnow", "Matsmart", "Notpla",
    "Traceless", "Sulapac", "Paptic", "Woodly",
    # sector - HR / future of work (40)
    "Haiilo", "Staffbase", "Blink", "Speakap", "Nailted", "Elevo", "Javelo",
    "Coorpacademy", "Rise Up", "GoodHabitz", "Studytube", "Learnster",
    "Edume", "Filtered", "Thrive Learning", "Learnerbly", "Zavvy",
    "Softgarden", "Zvoove", "Talentlyft", "Hireserve", "Applied", "Tribepad",
    "Textkernel", "Metaview", "Cord", "Otta", "Coople", "Temper",
    "YoungCapital", "Native Teams", "Parakar", "Lano", "Shyftplan", "Tamigo",
    "Bizneo", "Talentia", "Kelio", "Nmbrs", "Shiftbase",
    # sector - proptech / construction (52)
    "Homeday", "McMakler", "Evernest", "Immoweb", "Neho", "Nested", "Habito",
    "Molo Finance", "Perenna", "Selina Finance", "Tembo Money", "Sprive",
    "Generation Home", "Hometrack", "Sprift", "Kamma", "Yourkeys", "Reposit",
    "Flatfair", "Canopy", "Fixflo", "Plentific", "Arthur Online",
    "Coyote Software", "Re-Leased", "Spacemaker", "Bimobject", "Cadmatic",
    "Solibri", "Gropyus", "Kewazo", "Sablono", "Bulldozair", "Kaliti",
    "Finalcad", "Spaceflow", "Equiem", "Deskbird", "Optix", "Yoffix", "Habyt",
    "Colonies", "Cohabs", "Bob W", "Numa", "Hometogo", "Holidu", "Smoobu",
    "Avantio", "Doinn", "Apaleo", "Hostaway",
    # sector - legal / regtech (47)
    "Precisely", "Zefort", "Docue", "Pactum", "Contractpodai", "Summize",
    "Definely", "Genie AI", "Lexroom", "Noxtua", "Legalfly", "Jus Mundi",
    "Case Law Analytics", "Legito", "Legisway", "Legalcluster", "Signhost",
    "Scrive", "Verified", "Sumsub", "Shufti Pro", "Napier AI", "Elucidate",
    "Vneuron", "Hawk AI", "Silent Eight", "Regnology", "Suade Labs", "Vermeg",
    "Apiax", "Cube Global", "Clausematch", "Ascent Regtech", "Vixio",
    "Position Green", "Worldfavor", "Datamaran", "Apiday", "Osapiens",
    "Fonoa", "Taxdoo", "Marosa", "Hellotax", "Blue Dot", "Vatbox",
    "Datasnipper", "Auditdata",
    # sector - gaming / media / creator tools (66)
    "Coffee Stain Studios", "Ghost Ship Games", "IO Interactive", "Playdead",
    "Sybo Games", "Kiloo", "Reto Moto", "Thunderful", "Toadman Interactive",
    "Star Stable Entertainment", "Resolution Games", "Fast Travel Games",
    "Neon Giant", "Hello There Games", "Zordix", "Raw Fury", "Landfall Games",
    "Frozenbyte", "Nitro Games", "Housemarque", "Redhill Games",
    "Colossal Order", "Next Games", "PlayRaven", "Traplight", "Dream Games",
    "Overwolf", "Bunch", "Anzu", "Tapnation", "Voodoo", "Homa Games",
    "InnoGames", "Goodgame Studios", "Wooga", "Deck13", "Yager Development",
    "Mimimi Games", "Daedalic Entertainment", "Kolibri Games", "Klang Games",
    "Nordcurrent", "Estoty", "Tactile Games", "Lockwood Publishing",
    "Sumo Digital", "Playground Games", "Rebellion", "Splash Damage",
    "Frontier Developments", "Mediatonic", "Space Ape Games", "Bossa Studios",
    "Roll7", "Improbable", "Hadean", "Bidstack", "Audiomob", "Utopia Music",
    "Believe", "Acast", "Podme", "Endel", "Cyanite", "Musiio", "Vochlea",

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
# A throttled or briefly-broken ATS must never be recorded as "no board". Only
# these mean the board genuinely is not there; everything else is worth a retry.
# (Probing concurrently made this critical: 429s were being cached as permanent
# failures, which is what held the round-5 resolve rate down to 23%.)
DEFINITIVE_MISS = {400, 401, 403, 404, 410}
RETRY_STATUS = {408, 425, 429, 500, 502, 503, 504}


def _fetch(url, as_text=False):
    backoff = 0.6
    for attempt in range(4):
        try:
            r = _session().get(url, timeout=PROBE_TIMEOUT)
            if r.status_code == 200:
                return r.text if as_text else r.json()
            if r.status_code in DEFINITIVE_MISS:
                return None
            if r.status_code in RETRY_STATUS and attempt < 3:
                # Honour Retry-After when the ATS bothers to send one.
                wait = r.headers.get("Retry-After")
                try:
                    wait = min(float(wait), 10.0)
                except (TypeError, ValueError):
                    wait = backoff
                time.sleep(wait)
                backoff *= 2
                continue
            return None
        except Exception:
            time.sleep(backoff)
            backoff *= 2
    return None


def _get(url):
    return _fetch(url)


def _get_text(url):
    """Like _get but returns raw text (for the Teamtailor RSS feed)."""
    return _fetch(url, as_text=True)


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
def _still_alive(ats, token):
    """Re-probe a known board. A board that answers 0 gets one more chance after
    a pause — a flaky network moment must never prune a healthy company."""
    if probe_count(ats, token) > 0:
        return True
    time.sleep(1.0)
    return probe_count(ats, token) > 0


def resolve_company(name, cache=None, verify=False, retry_failed=False):
    """Return {name, ats, token, count, via}. ats/token are None if nothing
    resolved. One failure never raises.

    READ-ONLY on `cache`. The caller owns writing the result back, because with
    a thread pool an unsynchronized write here can resize the dict while
    save_cache() is serializing it.
    """
    # 1) Locked-in seeds always win (just confirm the live count).
    if name in SEED:
        ats, token = SEED[name]
        cnt = probe_count(ats, token)
        time.sleep(POLITE_DELAY)
        return {"name": name, "ats": ats, "token": token, "count": cnt, "via": "seed"}

    # 2) Cached answer (fast re-runs).
    if cache is not None and name in cache:
        hit = cache[name]
        if hit.get("ats"):
            if not verify:
                return hit
            # --verify: confirm the board still serves jobs. Tokens rot — a
            # company gets acquired, renames, or moves ATS, and the pipeline
            # then spends a slot every 6h fetching an empty board.
            if _still_alive(hit["ats"], hit["token"]):
                return dict(hit, via="verified")
            return {"name": name, "ats": None, "token": None, "count": 0,
                    "via": "pruned", "was": "{}:{}".format(hit["ats"], hit["token"])}
        if not retry_failed:
            return hit

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
                return {"name": name, "ats": ats, "token": tok,
                        "count": cnt, "via": "probe"}

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
    # Write-then-rename. Opening CACHE_FILE with "w" truncates it immediately,
    # so a crash part-way through json.dump() used to leave a short file — and
    # load_cache() swallows a parse error and returns {}, silently throwing away
    # hours of probing. rename() is atomic, so the old cache survives any crash.
    tmp = CACHE_FILE + ".tmp"
    with open(tmp, "w") as f:
        json.dump(cache, f, indent=2)
    os.replace(tmp, CACHE_FILE)


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
    lines.append("#   ats   = greenhouse | lever | ashby | smartrecruiters | recruitee | teamtailor")
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


def _arg(flag, default):
    return type(default)(sys.argv[sys.argv.index(flag) + 1]) if flag in sys.argv else default


def main():
    verify = "--verify" in sys.argv
    retry_failed = "--retry-failed" in sys.argv
    workers = _arg("--workers", DEFAULT_WORKERS)

    cache = load_cache()
    cache_lock = threading.Lock()
    progress = {"done": 0}

    # De-dupe but keep first-seen order: the list is hand-maintained across
    # expansion rounds and picks up repeats between country and sector blocks.
    names, seen = [], set()
    for nm in COMPANY_NAMES:
        if nm not in seen:
            seen.add(nm)
            names.append(nm)

    n = len(names)
    print("Resolving {} companies ({} workers{}{})...\n".format(
        n, workers, ", verify+prune" if verify else "",
        ", retry-failed" if retry_failed else ""))

    def work(name):
        try:
            r = resolve_company(name, cache=cache, verify=verify,
                                retry_failed=retry_failed)
        except Exception as e:  # a single bad name must never kill the run
            r = {"name": name, "ats": None, "token": None, "count": 0,
                 "via": "error: {}".format(e)}
        with cache_lock:
            # Cache every verdict except a seed (always re-probed live).
            if r.get("via") != "seed" and not r.get("via", "").startswith("error"):
                cache[name] = r
            progress["done"] += 1
            i = progress["done"]
            if r["ats"]:
                print("[{:>4}/{}] {:<26} -> {}:{} ({} jobs) [{}]".format(
                    i, n, name[:26], r["ats"], r["token"], r["count"], r["via"]))
            elif r.get("via") == "pruned":
                print("[{:>4}/{}] {:<26} -> PRUNED (was {})".format(
                    i, n, name[:26], r["was"]))
            else:
                print("[{:>4}/{}] {:<26} -> UNRESOLVED".format(i, n, name[:26]))
            if i % 25 == 0:
                # Snapshot inside the lock: json.dump() iterates lazily, so
                # handing it the live dict lets another thread resize it
                # mid-serialization ("dictionary changed size during iteration").
                save_cache(dict(cache))  # checkpoint, so a crash doesn't lose progress
        return r

    with ThreadPoolExecutor(max_workers=workers) as pool:
        results = list(pool.map(work, names))
    save_cache(cache)

    resolved, failed = write_companies_py(results)
    pruned = [r for r in results if r.get("via") == "pruned"]
    print("\nDone. {} resolved, {} unresolved ({} pruned as dead). Wrote companies.py."
          .format(resolved, failed, len(pruned)))
    if pruned:
        print("Pruned: " + ", ".join("{} ({})".format(r["name"], r["was"]) for r in pruned))


if __name__ == "__main__":
    main()
