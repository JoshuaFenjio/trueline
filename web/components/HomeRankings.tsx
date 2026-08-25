"use client";
import { useEffect, useMemo, useState } from "react";
import { PayIndexTable, PayScaleLegend } from "@/components/PayIndex";
import { TopCities } from "@/components/TopCities";
import { Combobox } from "@/components/Combobox";
import type { MapCity } from "@/lib/data";

interface Company { company: string; slug: string; sector: string; payScore: number }

// The homepage's two ranking blocks — top companies, top-paying cities. Each
// owns its own filter and re-filters client-side from cached board data;
// selections stay shareable via query params (?whoSector, ?whoLoc). They render
// as separate sections on the page, each under its own kicker + header.
export function TopCompaniesRanking({
  companies, sectors,
}: { companies: Company[]; sectors: string[] }) {
  const [sector, setSector] = useState("");
  useQueryParam("whoSector", sector, setSector);

  const rows = useMemo(
    () => companies.filter((c) => !sector || c.sector === sector).sort((a, b) => b.payScore - a.payScore).slice(0, 10),
    [companies, sector]
  );

  return (
    <>
      <Filters>
        <Combobox options={sectors} value={sector} onChange={setSector} placeholder="All companies" className="w-48" inputClassName="filter-pill w-full" />
        {sector && <Reset onClick={() => setSector("")} />}
      </Filters>
      <ColumnHead left="Company" right="Pay Score" />
      {rows.length > 0
        ? <PayIndexTable compact rows={rows.map((c) => ({ company: c.company, slug: c.slug, sector: c.sector, score: c.payScore }))} />
        : <p className="text-sm text-ink-faint">No companies match.</p>}
      <PayScaleLegend className="mt-3" />
      <p className="mt-2 text-[12px] text-ink-faint">Pay Score ranks each company&rsquo;s median base against its sector peers. Needs 3+ salaried postings.</p>
    </>
  );
}

export function TopCitiesRanking({
  cities, countries, emeaMedian,
}: { cities: MapCity[]; countries: string[]; emeaMedian: number }) {
  const [loc, setLoc] = useState("");
  useQueryParam("whoLoc", loc, setLoc);

  const filtered = useMemo(() => (loc ? cities.filter((c) => c.country === loc) : cities), [cities, loc]);

  return (
    <>
      <Filters>
        <Combobox options={countries} value={loc} onChange={setLoc} placeholder="All locations" className="w-48" inputClassName="filter-pill w-full" />
        {loc && <Reset onClick={() => setLoc("")} />}
      </Filters>
      <ColumnHead left="City" right="Median base salary" />
      {filtered.length > 0
        ? <TopCities cities={filtered} emeaMedian={emeaMedian} excludeConcentrated={!loc} />
        : <p className="text-sm text-ink-faint">Not enough city data for {loc}.</p>}
      <p className="mt-3 text-[12px] text-ink-faint">Ranked by median advertised base salary. Needs 5+ salaried postings per city.</p>
    </>
  );
}

// Read the param once on mount, then mirror the selection back into the URL.
function useQueryParam(key: string, value: string, set: (v: string) => void) {
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get(key)) set(p.get(key)!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    value ? p.set(key, value) : p.delete(key);
    const qs = p.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [key, value]);
}

function Filters({ children }: { children: React.ReactNode }) {
  return <div className="mb-5 flex flex-wrap items-center gap-3">{children}</div>;
}

function Reset({ onClick }: { onClick: () => void }) {
  return <button onClick={onClick} className="text-sm text-ink-muted transition-colors hover:text-[var(--accent)]">Reset</button>;
}

// Muted column-label row above a ranked table.
function ColumnHead({ left, right }: { left: string; right: string }) {
  return (
    <div className="mb-3 flex items-center justify-between border-b pb-2 text-[12px] text-ink-faint" style={{ borderColor: "var(--border)" }}>
      <span>{left}</span><span>{right}</span>
    </div>
  );
}
