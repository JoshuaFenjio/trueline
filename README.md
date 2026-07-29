# Trueline — Job + Salary Ingestion Pipeline

Pulls every currently-open job posting (with salaries where available) from a
list of companies via their public ATS APIs, stores them in a database, and
**never deletes anything** — jobs that disappear are kept forever as historical
benchmarks. Then it prints a coverage report so you can see which companies are
worth keeping.

Works with **zero setup** out of the box (stores to a local file). Optionally
stores to Supabase/Postgres instead.

---

## What you get each run

- A local database (`trueline.db`) with two tables: `companies` and `job_postings`.
- A full dump of the run in `jobs.json`.
- A printed **coverage report** showing, per company: how many active jobs,
  how many had a salary, the salary %, and a flag if something looks wrong.

Nothing is ever deleted. Re-running is safe and just refreshes the data.

---

## Quick start (copy-paste)

From a terminal:

```bash
cd ~/trueline

# 1) Create an isolated Python environment (so this can't affect anything else)
python3 -m venv venv
source venv/bin/activate

# 2) Install the two dependencies
pip install -r requirements.txt

# 3) Run it
python3 pipeline.py
```

That's it. You'll see progress for each company and a coverage report at the end.

### Run it again later

```bash
cd ~/trueline
source venv/bin/activate
python3 pipeline.py
```

Each run refreshes active jobs, marks vanished jobs as `expired` (kept, not
deleted), and updates the report.

---

## Adding / changing companies

Edit **`companies.py`** — it's the only file you normally touch. Each company is:

```python
{"name": "Stripe", "ats": "greenhouse", "token": "stripe"}
```

The `token` is the company's public ID in their careers URL, for example:

| ATS              | Example careers URL                 | token        |
|------------------|-------------------------------------|--------------|
| `greenhouse`     | boards.greenhouse.io/**stripe**     | `stripe`     |
| `lever`          | jobs.lever.co/**plaid**             | `plaid`      |
| `ashby`          | jobs.ashbyhq.com/**ramp**           | `ramp`       |
| `smartrecruiters`| jobs.smartrecruiters.com/**Visa**   | `Visa`       |

If a token is wrong, the company simply shows up in the report flagged
`⚠ 0 jobs (check token/ATS)` — the run does not crash.

---

## Reading the coverage report

```
company                 active  with_salary  salary_%  flag
----------------------------------------------------------------------
Plaid                       42           38       90%
Ramp                        51           20       39%
Stripe                     210            0        0%  — no salary yet
SomeCo                       0            0        0%  ⚠ 0 jobs (check token/ATS)
```

- **active** — jobs open right now.
- **with_salary** — how many had a salary we could extract.
- **salary_%** — your signal for "is this company worth keeping for benchmarking?"
- **flag** — `⚠ 0 jobs` means the token/ATS is probably wrong; `— no salary yet`
  means jobs exist but none exposed a salary.

---

## Using Supabase/Postgres instead of the local file (optional)

1. In your Supabase project, open the **SQL Editor** and run the SQL below to
   create the tables.
2. Copy `.env.example` to `.env` and fill in `SUPABASE_URL` and `SUPABASE_KEY`.
3. Run `python3 pipeline.py` as usual. It auto-detects the env vars and uses
   Supabase; otherwise it falls back to local SQLite.

### CREATE TABLE SQL (run once in Supabase)

```sql
create table if not exists companies (
    id          bigint generated always as identity primary key,
    name        text,
    ats         text,
    token       text,
    first_seen  timestamptz,
    last_seen   timestamptz,
    unique (ats, token)
);

create table if not exists job_postings (
    id              bigint generated always as identity primary key,
    company         text,
    ats             text,
    ats_job_id      text,
    title           text,
    role_family     text,
    location        text,
    city            text,
    country         text,
    remote          boolean,
    salary_min      double precision,
    salary_max      double precision,
    currency        text,
    salary_period   text,           -- year | month | hour
    salary_eur_min  double precision,
    salary_eur_max  double precision,
    salary_source   text,           -- structured | parsed | none
    posted_at       text,
    url             text,
    description     text,
    first_seen      timestamptz,
    last_seen       timestamptz,
    expired_at      timestamptz,
    status          text,           -- active | expired
    unique (ats, ats_job_id)
);
```

---

## How salaries are found

1. **Structured first** — if the ATS exposes a real salary field (Lever
   `salaryRange`, Ashby `compensation`, Greenhouse pay-range metadata), we use
   it. Marked `salary_source = structured`.
2. **Parsed from text** — otherwise we conservatively read the description.
   Handles `€ £ $`, codes `EUR GBP USD CHF PLN SEK DKK NOK`, `k` shorthand
   (`60k`, `£60k–80k`), `70,000` / `70.000`, ranges with `– - to "up to"`, and
   monthly-vs-annual cues. If unsure, it leaves the salary blank rather than guess.
   Marked `salary_source = parsed`.
3. **None** — nothing reliable found. Marked `salary_source = none`.

`salary_eur_min/max` are computed with an **approximate** static FX map for
rough cross-currency comparison. Refresh the rates in `pipeline.py` (`FX_TO_EUR`)
when you need precision.

> Note on SmartRecruiters: salary usually lives only in a per-job detail
> endpoint, so it is intentionally left off by default for speed. Those
> companies will show real job counts but few/no salaries.

---

## Files in this repo

| File              | What it is                                            |
|-------------------|-------------------------------------------------------|
| `pipeline.py`     | The whole pipeline.                                   |
| `companies.py`    | Your list of companies (the file you edit).           |
| `requirements.txt`| The two Python packages needed.                       |
| `.env.example`    | Template for optional Supabase settings.              |
| `README.md`       | This file.                                            |
| `trueline.db`     | Local database (created on first run).                |
| `jobs.json`       | Full dump of the latest run (created on first run).   |
