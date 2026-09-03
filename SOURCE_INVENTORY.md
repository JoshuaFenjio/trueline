# EMEA Salary-Source Inventory — TERMINAL SWEEP

**Signed off: 2026-09-03 · commit `ae85a24` · SalaryRadar data pipeline**

This is the definitive, per-country audit of every EMEA job board with mandatory
or high salary disclosure. Each candidate was checked for (1) a public/official
API or structured feed, (2) salary exposure, (3) robots.txt, (4) ToS. The
**permitted, machine-readable, salary-bearing universe is exhausted** as of this
date — remaining growth comes only from key/partner activation of the SCAFFOLD
rows below, not from new open sources.

Guiding rule applied throughout: **we ingest only where robots AND ToS permit.**
Where a site blocks AI/data-collection crawlers or signals `ai-train=no`, we
treat it as BLOCKED — we do **not** evade with a disguised user-agent.

## ✅ BUILT & WIRED (permitted · yielding · in scheduled runs)

| Source | Region | Interface | Salary | Yield (EMEA-usable) |
|---|---|---|---|---|
| Greenhouse / Lever / Ashby / SmartRecruiters / Recruitee / Teamtailor | pan-EMEA | ATS JSON | structured + parsed | ~4,900 salaried (core) |
| **Germantechjobs.de** | DE | public RSS | **mandatory** range in title | **826** (EUR, all usable) ★ |
| **Himalayas** | remote-EU | public keyless JSON | structured min/max | 29 (EMEA-currency only) |
| Landing.jobs | PT/remote | public API | structured | 9 (sentinel employer) |
| Personio | pan-EMEA | public XML feeds | prose-parsed | 0 to date (probe live) |

## 🔑 SCAFFOLD (permitted · built or documented · needs key/OAuth/partner — auto-activates)

| Source | Region | Gate | Salary |
|---|---|---|---|
| Adzuna | multi-EMEA | `ADZUNA_APP_ID/KEY` | yes (predicted hard-rejected) |
| Reed | UK | `REED_API_KEY` | yes |
| **ITJobs.pt** | PT | `ITJOBS_API_KEY` (free, email) | yes — `salaryMin/Max` (built, wired) |
| France Travail (Pôle emploi v2) | FR | OAuth client creds | yes — `salaire`; **delete-purge obligation** |
| VDAB Vacatures | BE-Flanders | account + key | sometimes |
| Bundesagentur für Arbeit | DE | OAuth / X-API-Key | pay-grade only (enrich needed) |
| Tecnoempleo | ES | API access request | yes (EUR) |
| StartupJobs.cz | CZ | per-company Bearer token | **structured** `salary{min,max}` |
| EURES | pan-EU | EU registration/auth | HR-Open (remuneration optional) |
| Techmap (jobdatafeeds) | FR/NL/BE | **paid** commercial licence | yes |
| NAV `pam-stilling-feed` | NO | self-serve token | **none** (no salary field) |
| Työmarkkinatori | FI | KEHA credentials | unconfirmed |

**Deferred (permitted but no structured feed / unverified ToS / negligible yield):**
Manfred (ES, `__NEXT_DATA__` scrape), karriere.at (AT, HTML), Jobicy (robots
unverifiable behind Cloudflare + ~1/50 yield), WeWorkRemotely (RSS, free-text,
global-skew), Arbeitnow (no structured salary field), 4dayweek.io (salary
unverified), RemoteOK (attribution-gated), Jobs.ie/JobsIreland (HTML), and the
HTML-only CEE/Baltic boards Pracuj.pl · Bulldogjob · theprotocol.it · eJobs.ro ·
BestJobs.ro · Hipo.ro · Profession.hu · CV.lt · CVKeskus.ee · jobs.cz · WTTJ-CZ ·
TheHub (no API, ToS pages 403'd — permission cannot be asserted).

## ⛔ BLOCKED (robots.txt or ToS forbids ingestion)

| Source | Region | Reason |
|---|---|---|
| InfoJobs.net | ES | ToS bans aggregators, benchmarking, data export w/o partnership |
| StepStone.de | DE | robots `Disallow: /public-api/` + job/search paths |
| kununu | DE/AT/CH | robots blocks `/api/` + salary-hub paths |
| jobs.ch | CH | robots `Disallow: /api/` + job-detail paths |
| Hellowork | FR | robots + CGU Art. 8.2 (explicit anti-scraping) |
| APEC | FR | CGU bars substantial DB extraction |
| Indeed (NL/IE) | NL/IE | robots blocks job paths + names AI crawlers; ToS |
| JustJoin.it | PL | robots `Disallow: /api/` |
| NoFluffJobs | PL | robots `Disallow: /api/` |
| Duunitori | FI | robots `Disallow: /` + salary paths + AI bots |
| finn.no | NO | robots copyright crawl-ban |
| Jobindex | DK | robots `Disallow: /api/` |
| Remotive | remote | ToS bans "building a database of job listings" |
| Cliccalavoro | IT | robots `Disallow: /api/` |
| CVbankas.lt · CV.ee · CV.lv | LT/EE/LV | AI/data-collection crawler block + `ai-train=no` (not evaded) |
| IrishJobs.ie | IE | ToS competitive-use clause |
| Nationale Vacaturebank | NL | no API; robots unverifiable |

## 💀 DEAD (not operating / API removed)

| Source | Region | Note |
|---|---|---|
| SwissDevJobs | CH | API returns "ENDPOINT Deprecated - contact us" |
| InfoJobs.it | IT | shut down; accounts deleted by 31 Dec 2025 |
| Wanted (wantedjobs.com) | — | parked/for-sale domain |

## 🚫 NO-SALARY (permitted but no per-offer salary — not worth building)

UWV / werk.nl (NL, aggregate) · gehalt.de (aggregate) · SEPE/Empléate (ES,
aggregate) · Net-Empregos, Sapo Emprego (PT) · Subito Lavoro (IT) ·
jobscout24.ch · TheHub (Nordic, inconsistent).

---

**Conclusion.** The permitted open-API/feed universe for EMEA salary data is
**exhausted**. The only remaining levers are administrative, not discovery:
activate the SCAFFOLD sources by obtaining their free/partner keys (highest value
first: **ITJobs.pt** [free], **France Travail** [free, honor delete-purge],
**Adzuna/Reed**). No further honest scraping targets remain.
