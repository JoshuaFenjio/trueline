"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps";
import topo from "@/lib/europe.topo.json";
import type { CompanyDetail } from "@/lib/data";
import { NO_DATA_FILL } from "@/lib/payScale";
import { eur, slugify } from "@/lib/format";

const NAME_ALIAS: Record<string, string> = { "Czech Republic": "Czechia" };
type Market = CompanyDetail["markets"][number];

// "Where [Company] hires" — Europe shaded by this company's active-posting count
// per country, office cities dotted, beside a ranked markets list.
export function CompanyHiresMap({ company, markets, offices }: {
  company: string; markets: CompanyDetail["markets"]; offices: CompanyDetail["offices"];
}) {
  const [mounted, setMounted] = useState(false);
  const [tip, setTip] = useState<{ x: number; y: number; name: string; m: Market | null } | null>(null);
  useEffect(() => setMounted(true), []);

  const byCountry = useMemo(() => new Map(markets.map((m) => [m.country, m])), [markets]);
  const max = Math.max(1, ...markets.map((m) => m.postings));
  const lookup = (name: string): Market | null => byCountry.get(NAME_ALIAS[name] ?? name) ?? null;
  const fillFor = (m: Market | null) => (m ? `rgba(15,118,110,${(0.2 + 0.75 * (m.postings / max)).toFixed(3)})` : NO_DATA_FILL);

  const mapEl = (
    <div className="relative">
      {mounted ? (
        <ComposableMap projection="geoAzimuthalEqualArea" projectionConfig={{ rotate: [-10, -53, 0], scale: 950 }} width={800} height={600} style={{ width: "100%", height: "auto" }}>
          <Geographies geography={topo as any}>
            {({ geographies }: any) => geographies.map((geo: any) => {
              const name = geo.properties.NAME as string;
              const m = lookup(name);
              return (
                <Geography
                  key={geo.rsmKey} geography={geo}
                  onMouseMove={(e: any) => {
                    const box = (e.currentTarget.ownerSVGElement.parentElement as HTMLElement).getBoundingClientRect();
                    setTip({ x: e.clientX - box.left, y: e.clientY - box.top, name, m });
                  }}
                  onMouseLeave={() => setTip(null)}
                  style={{
                    default: { fill: fillFor(m), stroke: "var(--bg)", strokeWidth: 0.6, outline: "none" },
                    hover: { fill: fillFor(m), stroke: "var(--ink)", strokeWidth: 0.9, outline: "none" },
                    pressed: { fill: fillFor(m), outline: "none" },
                  }}
                />
              );
            })}
          </Geographies>
          {offices.map((o) => (
            <Marker key={o.city} coordinates={[o.lon, o.lat]}>
              <circle r={3} fill="var(--ink)" stroke="#fff" strokeWidth={1} />
            </Marker>
          ))}
        </ComposableMap>
      ) : (
        <div className="h-[360px] w-full animate-pulse rounded-card" style={{ background: "var(--surface-2)" }} />
      )}
      {tip && tip.m && (
        <div className="pointer-events-none absolute z-20 w-48 rounded-xl border p-3 text-sm shadow-glow" style={{ left: Math.min(tip.x + 12, 560), top: tip.y + 12, background: "#fff", borderColor: "var(--border)" }}>
          <div className="font-semibold">{tip.m.country}</div>
          <div className="tnum mt-1 text-ink">{tip.m.postings} posting{tip.m.postings === 1 ? "" : "s"}</div>
          <div className="tnum text-xs text-ink-faint">{tip.m.median != null ? `${eur(tip.m.median)} median` : "median needs 3+"}</div>
        </div>
      )}
    </div>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="surface overflow-hidden rounded-card">
        <div className="flex items-center gap-3 border-b px-4 py-2.5 text-[11px] text-ink-faint" style={{ borderColor: "var(--border)" }}>
          <span className="flex-1">Market</span><span className="w-20 text-right">Postings</span><span className="w-24 text-right">Median</span>
        </div>
        <ol>
          {markets.map((m) => (
            <li key={m.country} className="border-t" style={{ borderColor: "var(--border)" }}>
              <Link href={`/locations/country/${slugify(m.country)}`} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[var(--band)]">
                <span className="flex-1 truncate">{m.country}</span>
                <span className="tnum w-20 text-right">{m.postings}</span>
                <span className="tnum w-24 text-right text-ink-muted">{m.median != null ? eur(m.median) : "—"}</span>
              </Link>
            </li>
          ))}
          {markets.length === 0 && <li className="px-4 py-6 text-sm text-ink-faint">No located postings yet.</li>}
        </ol>
      </div>
      <div className="hidden lg:block">
        {mapEl}
        <div className="tnum mt-3 flex items-center gap-4 text-[11px] text-ink-faint">
          <span className="flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: "rgba(15,118,110,0.85)" }} /> more postings</span>
          <span className="flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-full" style={{ background: "var(--ink)" }} /> office city</span>
        </div>
      </div>
    </div>
  );
}
