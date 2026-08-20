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

  const selCls = "cursor-pointer rounded-lg border px-3 py-2 text-sm";
  const selStyle = { background: "#fff", borderColor: "var(--border)" } as const;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <select value={sector} onChange={(e) => setSector(e.target.value)} className={selCls} style={selStyle} aria-label="Sector">
          <option value="">All companies</option>
          {sectors.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={loc} onChange={(e) => setLoc(e.target.value)} className={selCls} style={selStyle} aria-label="Location">
          <option value="">All locations</option>
          {countries.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        {(sector || loc) && (
          <button onClick={() => { setSector(""); setLoc(""); }} className="text-sm text-ink-muted transition-colors hover:text-[var(--accent)]">Reset</button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <div className="mb-2 text-[11px] text-ink-faint">Top companies{sector ? ` · ${sector}` : ""} · Pay Score</div>
          {topCompanies.length > 0
            ? <PayIndexTable compact rows={topCompanies.map((c) => ({ company: c.company, slug: c.slug, sector: c.sector, score: c.payScore }))} />
            : <p className="text-sm text-ink-faint">No companies match.</p>}
          <PayScaleLegend className="mt-3" />
        </div>
        <div>
          <div className="mb-2 text-[11px] text-ink-faint">Top-paying cities{loc ? ` · ${loc}` : ""} · median base</div>
          {filteredCities.length > 0
            ? <TopCities cities={filteredCities} emeaMedian={emeaMedian} excludeConcentrated={!loc} />
            : <p className="text-sm text-ink-faint">Not enough city data for {loc}.</p>}
        </div>
      </div>
    </div>
  );
}
