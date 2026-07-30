#!/usr/bin/env python3
# Backfill region + multi_market over stored rows using the tightened classifier.
# Never deletes — only re-tags. Prints before/after reclassification counts.
import sqlite3
from pipeline import classify_region

DB = "trueline.db"
EMEA_CURRENCIES = {"EUR", "GBP", "CHF", "SEK", "DKK", "NOK", "PLN"}

conn = sqlite3.connect(DB)
conn.row_factory = sqlite3.Row
c = conn.cursor()

# Ensure columns exist (idempotent).
for col, decl in (("region", "TEXT"), ("multi_market", "INTEGER")):
    try:
        c.execute("ALTER TABLE job_postings ADD COLUMN {} {}".format(col, decl))
    except sqlite3.OperationalError:
        pass
conn.commit()

rows = c.execute("""SELECT id, location, city, country, status, salary_source, currency,
                    region AS old_region, multi_market AS old_mm
                    FROM job_postings""").fetchall()

total = len(rows)
active = sum(1 for r in rows if r["status"] == "active")
salaried_active = sum(1 for r in rows if r["status"] == "active" and r["salary_source"] != "none")

after = {"EMEA": 0, "NONEMEA": 0, "UNKNOWN": 0}
active_after = {"EMEA": 0, "NONEMEA": 0, "UNKNOWN": 0}
multi = 0
active_now_nonemea = 0
salaried_excluded_nonemea = 0
salaried_excluded_currency = 0
updates = []
for r in rows:
    region, mm = classify_region(r["location"], r["city"], r["country"])
    updates.append((region, 1 if mm else 0, r["id"]))
    after[region] += 1
    if mm:
        multi += 1
    if r["status"] == "active":
        active_after[region] += 1
        if region == "NONEMEA":
            active_now_nonemea += 1
            if r["salary_source"] != "none":
                salaried_excluded_nonemea += 1
        elif r["salary_source"] != "none" and mm and (r["currency"] or "").upper() not in EMEA_CURRENCIES:
            salaried_excluded_currency += 1

c.executemany("UPDATE job_postings SET region=?, multi_market=? WHERE id=?", updates)
conn.commit()

print("=" * 62)
print("REGION BACKFILL — before / after")
print("=" * 62)
print("Stored rows (never deleted):        {}".format(total))
print("  of which active:                  {}".format(active))
print("  of which salaried & active:       {}".format(salaried_active))
print()
print("BEFORE: every stored row was kept as EMEA (old filter had no US-locality")
print("        override, so US roles like 'Lake Zurich, Illinois' slipped in).")
print()
print("AFTER (all rows re-tagged):")
print("  region = EMEA:                    {}".format(after["EMEA"]))
print("  region = NONEMEA:                 {}".format(after["NONEMEA"]))
print("  region = UNKNOWN (kept):          {}".format(after["UNKNOWN"]))
print("  multi_market flagged:             {}".format(multi))
print()
print("RECLASSIFIED among ACTIVE postings:")
print("  active now NONEMEA (excluded):    {}  <- these were previously counted".format(active_now_nonemea))
print("  active EMEA / UNKNOWN (kept):     {}".format(active_after["EMEA"] + active_after["UNKNOWN"]))
print()
print("SALARY IMPACT on active salaried ({}):".format(salaried_active))
print("  dropped — reclassified NONEMEA:   {}".format(salaried_excluded_nonemea))
print("  dropped — multi_market non-EMEA $: {}".format(salaried_excluded_currency))
print("  remaining EMEA salary points:     {}".format(
    salaried_active - salaried_excluded_nonemea - salaried_excluded_currency))
print("=" * 62)

# A few concrete examples
print("\nExamples now reclassified NONEMEA (active):")
for r in c.execute("""SELECT company, location FROM job_postings
                      WHERE status='active' AND region='NONEMEA'
                      GROUP BY location LIMIT 8"""):
    print("  {:16} {}".format(r["company"][:16], r["location"]))
print("\nExamples flagged multi_market (active):")
for r in c.execute("""SELECT company, location FROM job_postings
                      WHERE status='active' AND multi_market=1
                      GROUP BY location LIMIT 6"""):
    print("  {:16} {}".format(r["company"][:16], r["location"]))
conn.close()
