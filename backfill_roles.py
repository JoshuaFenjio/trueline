#!/usr/bin/env python3
# Re-tag role_family over all stored rows with the extended classifier.
# Never deletes. Prints before/after role distribution. Run migrate.py after to
# push the new role_family values to Supabase.
import sqlite3
from pipeline import classify_role

conn = sqlite3.connect("trueline.db")
conn.row_factory = sqlite3.Row
c = conn.cursor()

rows = c.execute("SELECT id, title, role_family, status, salary_source FROM job_postings").fetchall()

before = {}
after_active = {}
after_sal = {}
updates = []
changed = 0
for r in rows:
    new = classify_role(r["title"])
    if r["status"] == "active":
        before[r["role_family"]] = before.get(r["role_family"], 0) + 1
    if new != r["role_family"]:
        changed += 1
    updates.append((new, r["id"]))
    if r["status"] == "active":
        after_active[new] = after_active.get(new, 0) + 1
        if r["salary_source"] != "none":
            after_sal[new] = after_sal.get(new, 0) + 1

c.executemany("UPDATE job_postings SET role_family=? WHERE id=?", updates)
conn.commit()

print("Rows re-tagged: {} (changed: {})\n".format(len(rows), changed))
print("BEFORE (active postings, old taxonomy):")
for role in sorted(before, key=lambda k: -before[k]):
    print("  {:22} {}".format(role, before[role]))

print("\nAFTER — ROLE COVERAGE (active postings):")
print("  {:22} {:>9} {:>9}".format("role", "postings", "salaried"))
for role in sorted(after_active, key=lambda k: -after_active[k]):
    print("  {:22} {:>9} {:>9}".format(role, after_active[role], after_sal.get(role, 0)))
conn.close()
