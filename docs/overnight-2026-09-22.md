# Overnight final pass — 2026-09-22

Fourteen numbered items, each implemented, verified, committed and pushed in
order. This is the record.

---

## 1. Route verification

Every route rendered in a real browser against **production**
(`https://trueline-azure.vercel.app`). "Real number" is pulled from the
rendered `<main>`, so a route cannot pass here by rendering its chrome with no
data. "Flags" counts country-flag glyphs in place rows.

| Route | HTTP | Real number | Footer | Flags |
|---|---|---|---|---|
| `/` | 200 | €65,000 | ✓ (21 links) | ✓ 28 |
| `/roles` | 200 | €115,000 | ✓ | — (no place rows) |
| `/roles/software-engineer` | 200 | €67,000 | ✓ | ✓ 43 |
| `/roles/software-engineer/senior` | 200 | €51k | ✓ | ✓ 8 |
| `/roles/account-executive/director` | 200 | €51k | ✓ | — |
| `/roles/software-engineer/postings` | 200 | €54k–€80k | ✓ | ✓ 90 |
| `/locations` | 200 | €116,000 | ✓ | ✓ 31 |
| `/locations/london` | 200 | €116,000 | ✓ | ✓ 5 |
| `/locations/countries` | 200 | €96,000 | ✓ | ✓ 44 |
| `/locations/country/germany` | 200 | €65,000 | ✓ | ✓ 8 |
| `/companies` | 200 | €252,000 | ✓ | — (company rows) |
| `/companies/wise` | 200 | €112,000 | ✓ | ✓ 12 |
| `/companies/revolut` (watchlist) | 200 | — by design | ✓ | — |
| `/compare?companies=wise,monzo` | 200 | €112,000 | ✓ | ✓ 7 |
| `/leaderboards` | 200 | €65,000 | ✓ | ✓ 31 |
| `/methodology` | 200 | 100 (Pay Score scale) | ✓ | — |
| `/for-companies` | 200 | — (no data page) | ✓ | — |
| `/add` | 200 | — (form) | ✓ | — |
| `/add/thanks` | 200 | — (confirmation) | ✓ | — |
| `/request?q=platform+engineer` | 200 | €24k–€56k | ✓ | ✓ 14 |
| `/request/verify` | 200 | — (token page) | ✓ | — |
| `/admin` | 200 | — (login) | ✓ slim (by design) | — |
| `/this-route-does-not-exist` | 404 | — | ✓ | — |

Wider sweeps behind that table:

- **1,526 sitemap URLs** fetched: **0 non-200, 0 without a footer**.
- **2,840 page-renders** (1,582 routes at 1024px and 1280px) checked for ranked
  rows with a blank or zero-width name: **0 found**.
- `next build` completes clean: no errors, no warnings, 206 role × level pages
  pre-rendered.

---

## 2. Commits, in order

| # | Hash | Item |
|---|---|---|
| 1 | `0cfd7d5` | Role-request flow: show the matching postings, deep-link the family |
| 2 | `83e3b38` | Relabel every stat band so the figure explains itself |
| 3 | `a6f98b6` | Role-sounding display names for role families |
| 4 | `37d6132` | Management seniority track (explicit signal only) |
| 5 | `0d84f82` | Role pages: role-scoped EMEA map, latest postings, country view, empty-cell fix |
| 6 | `01932fd` | Logo sweep across every scraped company + logos in the type-ahead |
| 7 | `e249b46` | Company pages: reordered, complete roles, company-scoped locations, facts |
| 8 | `58a5456` | Pay Index: the ranking first, the explainer behind "How it works" |
| 9 | `44f1660` | /add: type-ahead everywhere, exact title, total-comp context, real confirmation |
| 10 | `45857e0` | "Recently added by the community" — approved submissions only |
| 11 | `fc43e54` | Brand lockup traced from brand-reference.png |
| 12 | `9d54107` | Footer audit: every route, and 324 sitemap URLs that 404'd |
| 13 | `5d55a0e` | Photo QA: contact sheet, a repeatable reject gate, and 21 re-fetched heroes |
| 14 | `cb4f6a8` | Mockup fidelity sweep — one pass, four fixes, deviations listed |

**Production is serving `cb4f6a8`** — GitHub deployment for that SHA reports
`state: success` to the Production environment, and the live site returns the
markers unique to it (lens cards, brand-green lockup, "role families
benchmarked" labels, the 1,529-URL corrected sitemap).

---

## 3. Blocked and partial, with reasons

**7d — non-EMEA markets ("also operates in") — PARTIALLY BLOCKED.**
The ask was the full country list including the USA. The pipeline drops
non-EMEA postings at ingest (`pipeline.py`, the region keep-filter): there are
**0 active NONEMEA rows** in the corpus, 20 legacy ones in total. Unblocking it
needs a pipeline change plus a full re-scrape, which is not something to start
unattended. Delivered instead from data we actually hold: the markets module
states the EMEA-only scope plainly, and where an employer's own multi-location
ad names a non-EMEA office ("London; Sunnyvale") those are listed as "also
operates in" — derived from the 93 stored multi-market rows, never presented as
a market we benchmark.

**9c / 9d — submission context columns — NEEDS A MIGRATION.**
`migrations/2026-09-submission-context.sql` adds `exact_title`, `bonus_eur`,
`equity_note`, `comments` to `submissions` and `role` to `leads`. It cannot be
applied from here: PostgREST has no DDL and there is no database password in the
environment. **Run it in the Supabase SQL editor.** Until then the code degrades
rather than failing — the insert retries with the core columns so a salary is
never lost, and the lead insert retries without `role`. Verified end-to-end
today against the un-migrated table: the submission saved with the extras
dropped.

**7e — employee counts, HQ, founded for the new entries — LEFT BLANK.**
There is no source in config we can stand behind, and a headcount recalled from
memory is exactly the kind of number this project refuses to print. The
`employees` field exists on `CompanyMeta` so a verified source can be dropped in
without a schema change. Blanks stay blank.

**10 — community module is invisible in production, correctly.**
There are 0 approved submissions (1 pending), and the module renders nothing
below 3. Verified in all three states: 0 approved (absent — the real state), a
local 2-entry fixture (still absent, gate holds), and a local 4-entry fixture
(renders correctly). No fixture rows were written to the database.

**12 — one framework limitation, stated precisely.**
Next 14 streams the `/_not-found` shell first for a `notFound()` raised inside a
dynamic segment, so the very first SSR bytes still lack the layout. The segment
boundary resolves immediately after and the delivered page is complete, with
nav, the 21-link footer and per-segment copy. Not overridable from the app in
14.2; it only affects 404s.

**11 — one deliberate typographic deviation.**
The reference wordmark is 3.45 × mark-height wide; ours lands at 3.90. The
reference is set in a narrower face and Schibsted Grotesk at 800 runs ~13% wider
per unit of cap height. Fonts are locked, so cap height, weight, colour and the
mark-to-wordmark gap match exactly (gap measured on the rendered nav: 0.315,
exact) and the width is left honest rather than faked with a `scaleX` that would
distort the strokes.

**13 — Cardiff has no photo, on purpose.**
Three queries returned a stadium concourse and two subject-less frames. It falls
back to the designed tinted silhouette rather than shipping a weak hero.

---

## 4. Coverage

### Logos

| | Before | After |
|---|---|---|
| Companies with a resolvable logo | 439 / 2,460 (17.9%) | **1,366 / 2,460 (55.5%)** |
| Job ads whose employer shows a logo | 14,457 / 20,358 (71.0%) | **17,829 / 20,358 (87.6%)** |

Remaining letter-marks: **1,094 companies / 2,529 job ads**. Largest by ad
count: Schwarz Digits 70, Applied 60, Headway 53, Smartly.io 26, Deutsche Bahn
AG 24, Debeka-Gruppe 20, Bynder 20, adesso business consulting 17, IRIUM 16,
Mirakl 16, EY Deutschland 16, Affirm 15, Unit4 15. Full list in
`logo_lettermarks.json`.

Every accepted domain has evidence: the company publishes job ads from it
(75), or its label matches the company name **and** the site's own homepage
names the company (834), or it was hand-checked against that homepage (43). A
label match alone is never accepted — `moss.com` is a construction firm and
`zeb.com` is a Belgian fashion retailer. The manual pass corrected five
auto-resolutions the weaker rule would have shipped.

### Photos

**39 of 40 places** have a hero photo (Cardiff on the silhouette fallback).
8.1 MB total, 100–345 KB per WebP. 21 heroes were re-fetched after the contact
sheet; the reject gate is now in the fetcher, validated to reject exactly the 11
that fail on measurable grounds and pass all 26 keepers. Photographer credits
render on every hero and in full on `/methodology`.

### New seniority cells

The management track unlocked **10 role × level pages** that did not exist
before (58 role × level pages now clear n≥8, up from 48):

```
/roles/account-executive/director        /roles/other/director
/roles/bizdev-partnerships/manager       /roles/other/manager
/roles/compliance/manager                /roles/product-manager/director
/roles/engineering-manager/manager       /roles/security-engineer/manager
/roles/engineering-manager/senior-manager  /roles/software-engineer/manager
```

Corpus backfill: 2,798 rows patched, second run finds 0. Active-row level
distribution after: Staff+ 2,627 → 1,540, Director 695, Manager 652, VP+ 112,
Senior Manager 91, Senior Director 30, and 42 rows that had no level at all now
have one. `level_source` stays `explicit` for every management tier — nothing is
inferred.

Parity between `pipeline.classify_level` and `web/lib/levels.classifyLevel`
tested over all 16,667 unique live titles: **0 mismatches**.

---

## 5. Census

| | |
|---|---|
| Companies with live postings | 2,460 |
| Companies disclosing pay | 1,811 |
| Companies ranked (n≥3) | 464 |
| Active postings | 20,356 |
| **Median-eligible (salaried)** | **6,205 (30.5%)** |
| Disclose any pay (raw) | 8,091 |
| Distinct job titles | 16,414 |
| "Other" role share | 18.5% |

**Benchmarks published:** 44 role families with a median (the residual "Other"
bucket is excluded from that count), 58 role × level pages, 180 cities and 39
countries with their own page, 19 countries with a published median, 10 clearing
the n≥15 flagship gate.

Gates unchanged throughout: **n≥8** median, **n≥15** flagship, **n≥3** company.
Bonus, equity and comments are stored separately and never enter a base median.
