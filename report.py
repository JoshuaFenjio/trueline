#!/usr/bin/env python3
# One-off dataset report. Reads trueline.db + reuses the website's sector map
# (web/lib/sectors.ts) as the single source of truth for company -> sector.
import sqlite3, re, os

ROOT = os.path.dirname(os.path.abspath(__file__))

def load_sector_map():
    ts = open(os.path.join(ROOT, "web/lib/sectors.ts")).read()
    m = {}
    for name_q, name_b, sector in re.findall(
        r'(?:"([^"]+)"|([A-Za-z][\w]*))\s*:\s*"(AI|Fintech|Devtools|SaaS|Consumer|Health|Mobility|Security|Other)"',
        ts):
        m[(name_q or name_b)] = sector
    return m

SECTOR = load_sector_map()
def sector_of(c): return SECTOR.get(c, "Other")

c = sqlite3.connect(os.path.join(ROOT, "trueline.db")).cursor()

def scalar(q): return c.execute(q).fetchone()[0]

companies = scalar("SELECT COUNT(DISTINCT company) FROM job_postings WHERE status='active'")
active = scalar("SELECT COUNT(*) FROM job_postings WHERE status='active'")
salaried = scalar("SELECT COUNT(*) FROM job_postings WHERE status='active' AND salary_source!='none'")
pct = (salaried / active * 100) if active else 0

print("=" * 60)
print("TRUELINE DATASET REPORT")
print("=" * 60)
print(f"Companies resolved (with active postings): {companies}")
print(f"Total EMEA active postings:                {active}")
print(f"Total salaried postings:                   {salaried}")
print(f"Overall salary %:                          {pct:.1f}%")

print("\nTOP 25 COMPANIES BY SALARY COUNT")
print(f"  {'company':22} {'salaried':>8} {'active':>7} {'sal%':>6}  sector")
rows = c.execute("""
  SELECT company,
         SUM(CASE WHEN salary_source!='none' THEN 1 ELSE 0 END) sal,
         COUNT(*) act
  FROM job_postings WHERE status='active'
  GROUP BY company ORDER BY sal DESC, act DESC LIMIT 25""").fetchall()
for comp, sal, act in rows:
    p = (sal / act * 100) if act else 0
    print(f"  {comp[:22]:22} {sal:>8} {act:>7} {p:>5.0f}%  {sector_of(comp)}")

print("\nSECTOR COVERAGE (companies with active postings)")
print(f"  {'sector':12} {'companies':>10} {'salaried postings':>18}")
agg = {}
for comp, sal, act in c.execute("""
  SELECT company, SUM(CASE WHEN salary_source!='none' THEN 1 ELSE 0 END), COUNT(*)
  FROM job_postings WHERE status='active' GROUP BY company"""):
    s = sector_of(comp)
    a = agg.setdefault(s, {"companies": 0, "salaried": 0})
    a["companies"] += 1
    a["salaried"] += sal or 0
for sec in sorted(agg, key=lambda s: -agg[s]["salaried"]):
    a = agg[sec]
    print(f"  {sec:12} {a['companies']:>10} {a['salaried']:>18}")
print("=" * 60)
