"use client";
import { useEffect, useMemo, useState } from "react";
import { PayIndexTable, PayScaleLegend } from "@/components/PayIndex";
import { TopCities } from "@/components/TopCities";
import type { MapCity } from "@/lib/data";

interface Company { company: string; slug: string; sector: string; payScore: number }

// Interactive "Who pays the most": sector + location selects re-filter both
// tables client-side from cached board data. Selection is shareable via query
// params (?whoSector, ?whoLoc).
export function WhoPaysInteractive({
  companies, cities, sectors, countries, emeaMedian,
}: {
  companies: Company[]; cities: MapCity[]; sectors: string[]; countries: string[]; emeaMedian: number;
}) {
  const [sector, setSector] = useState("");
  const [loc, setLoc] = useState("");

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("whoSector")) setSector(p.get("whoSector")!);
    if (p.get("whoLoc")) setLoc(p.get("whoLoc")!);
  }, []);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    sector ? p.set("whoSector", sector) : p.delete("whoSector");
    loc ? p.set("whoLoc", loc) : p.delete("whoLoc");
    const qs = p.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [sector, loc]);

  const topCompanies = useMemo(
    () => companies.filter((c) => !sector || c.sector === sector).sort((a, b) => b.payScore - a.payScore).slice(0, 10),
    [companies, sector]
  );
  const filteredCities = useMemo(
    () => (loc ? cities.filter((c) => c.country === loc) : cities),
    [cities, loc]
  );

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <select value={sector} onChange={(e) => setSector(e.target.value)} className="filter-pill" aria-label="Sector">
          <option value="">All companies</option>
          {sectors.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={loc} onChange={(e) => setLoc(e.target.value)} className="filter-pill" aria-label="Location">
          <option value="">All locations</option>
          {countries.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        {(sector || loc) && (
          <button onClick={() => { setSector(""); setLoc(""); }} className="text-sm text-ink-muted transition-colors hover:text-[var(--accent)]">Reset</button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <CardHead
            icon={<BuildingIcon />}
            title={`Top companies${sector ? ` · ${sector}` : ""}`}
            left="Company" right="Pay Score"
          />
          {topCompanies.length > 0
            ? <PayIndexTable compact rows={topCompanies.map((c) => ({ company: c.company, slug: c.slug, sector: c.sector, score: c.payScore }))} />
            : <p className="text-sm text-ink-faint">No companies match.</p>}
          <PayScaleLegend className="mt-3" />
          <p className="mt-2 text-[12px] text-ink-faint">Pay Score ranks each company&rsquo;s median base against its sector peers. Needs 3+ salaried postings.</p>
        </div>
        <div>
          <CardHead
            icon={<PinIcon />}
            title={`Top-paying cities${loc ? ` · ${loc}` : ""}`}
            left="City" right="Median base salary"
          />
          {filteredCities.length > 0
            ? <TopCities cities={filteredCities} emeaMedian={emeaMedian} excludeConcentrated={!loc} />
            : <p className="text-sm text-ink-faint">Not enough city data for {loc}.</p>}
          <p className="mt-3 text-[12px] text-ink-faint">Ranked by median advertised base salary. Needs 5+ salaried postings per city.</p>
        </div>
      </div>
    </div>
  );
}

// Card header: tinted icon chip + title (15/600) + a muted column-label row.
function CardHead({ icon, title, left, right }: { icon: React.ReactNode; title: string; left: string; right: string }) {
  return (
    <div className="mb-3">
      <div className="flex items-center gap-2.5">
        <span className="icon-chip" aria-hidden="true">{icon}</span>
        <span className="text-[15px] font-semibold">{title}</span>
      </div>
      <div className="mt-2.5 flex items-center justify-between border-b pb-2 text-[12px] text-ink-faint" style={{ borderColor: "var(--border)" }}>
        <span>{left}</span><span>{right}</span>
      </div>
    </div>
  );
}

function BuildingIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="2.5" width="7" height="11" rx="1" /><path d="M9.5 6.5h4v7h-4" />
      <path d="M4.5 5h1M6.5 5h1M4.5 7.5h1M6.5 7.5h1M4.5 10h1M6.5 10h1M11 9h.5M11 11h.5" />
    </svg>
  );
}
function PinIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 14.5c2.5-3 4.5-5.2 4.5-7.5a4.5 4.5 0 1 0-9 0c0 2.3 2 4.5 4.5 7.5Z" /><circle cx="8" cy="7" r="1.6" />
    </svg>
  );
}
