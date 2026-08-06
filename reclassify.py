# Re-apply the (widened) classify_role rules to every stored posting, so rows
# scraped before a taxonomy change get the new role_family. Run from repo root
# after editing classify_role in pipeline.py:  python3 reclassify.py
import sqlite3
from pipeline import classify_role

DB = "trueline.db"


def main():
    c = sqlite3.connect(DB)
    rows = c.execute("SELECT id, title, role_family FROM job_postings").fetchall()
    changed = 0
    moved = {}
    for rid, title, old in rows:
        new = classify_role(title or "")
        if new != old:
            c.execute("UPDATE job_postings SET role_family=? WHERE id=?", (new, rid))
            moved[(old, new)] = moved.get((old, new), 0) + 1
            changed += 1
    c.commit()
    print("reclassified {}/{} rows".format(changed, len(rows)))
    for (old, new), n in sorted(moved.items(), key=lambda x: -x[1])[:20]:
        print("  {:>14} -> {:<18} {}".format(old, new, n))


if __name__ == "__main__":
    main()
