"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import topo from "@/lib/europe.topo.json";
import type { EuropePayData, CountryPay } from "@/lib/data";
import { payColor, scoreFromRatio, NO_DATA_FILL } from "@/lib/payScale";
import { PayScaleLegend } from "@/components/PayIndex";
import { eur, slugify } from "@/lib/format";

// topojson NAME -> our canonical country name
const NAME_ALIAS: Record<string, string> = { "Czech Republic": "Czechia" };

export function EuropePayMap({ data }: { data: EuropePayData }) {
  const [mounted, setMounted] = useState(false);
  const [role, setRole] = useState("All roles");
  const [showTop, setShowTop] = useState(false);
  const [tip, setTip] = useState<{ x: number; y: number; name: string; c: CountryPay | null } | null>(null);
  const router = useRouter();
  useEffect(() => setMounted(true), []);

  const rp = data.data[role] ?? data.data["All roles"];
  const byCountry = useMemo(() => new Map(rp.countries.map((c) => [c.country, c])), [rp]);
  const lookup = (name: string): CountryPay | null => byCountry.get(NAME_ALIAS[name] ?? name) ?? null;

  return (
    <div>
      {/* Controls */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="tnum text-[11px] uppercase tracking-wider text-ink-faint">Role</label>
        <select value={role} onChange={(e) => setRole(e.target.value)} className="field px-3 py-2 text-sm">
          <option>All roles</option>
          {data.roles.map((r) => <option key={r}>{r}</option>)}
        </select>
        <button
          onClick={() => setShowTop((v) => !v)}
          className="rounded-lg border px-3 py-2 text-sm transition-colors"
          style={showTop
            ? { background: "var(--accent-soft)", borderColor: "var(--accent)", color: "var(--accent)" }
            : { background: "var(--surface-1)", color: "var(--ink-muted)" }}
        >
          Top payers {showTop ? "on" : "off"}
        </button>
        <span className="tnum ml-auto text-xs text-ink-faint">EMEA median {eur(rp.emeaMedian)}</span>
      </div>

      {/* Map */}
      <div className="relative">
        {mounted ? (
          <ComposableMap
            projection="geoAzimuthalEqualArea"
            projectionConfig={{ rotate: [-10, -53, 0], scale: 950 }}
            width={800} height={600}
            style={{ width: "100%", height: "auto" }}
          >
            <Geographies geography={topo as any}>
              {({ geographies }: any) =>
                geographies.map((geo: any) => {
                  const name = geo.properties.NAME as string;
                  const c = lookup(name);
                  const fill = c && c.median != null ? payColor(scoreFromRatio(c.median, rp.emeaMedian)) : NO_DATA_FILL;
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      onMouseEnter={() => setTip((t) => ({ x: t?.x ?? 0, y: t?.y ?? 0, name, c }))}
                      onMouseMove={(e: any) => {
                        const box = (e.currentTarget.ownerSVGElement.parentElement as HTMLElement).getBoundingClientRect();
                        setTip({ x: e.clientX - box.left, y: e.clientY - box.top, name, c });
                      }}
                      onMouseLeave={() => setTip(null)}
                      onClick={() => c && router.push(`/locations/country/${slugify(c.country)}`)}
                      style={{
                        default: { fill, stroke: "var(--bg)", strokeWidth: 0.6, outline: "none", cursor: c ? "pointer" : "default" },
                        hover: { fill, stroke: "var(--ink)", strokeWidth: 0.8, outline: "none", filter: "brightness(0.94)" },
                        pressed: { fill, outline: "none" },
                      }}
                    />
                  );
                })
              }
            </Geographies>
          </ComposableMap>
        ) : (
          <div className="h-[400px] w-full animate-pulse rounded-card" style={{ background: "var(--surface-2)" }} />
        )}

        {/* Tooltip */}
        {tip && (
          <div
            className="pointer-events-none absolute z-20 w-56 rounded-xl border p-3 text-sm shadow-glow"
            style={{ left: Math.min(tip.x + 12, 560), top: tip.y + 12, background: "#fff", borderColor: "var(--border)" }}
          >
            <div className="font-semibold">{tip.c?.country ?? NAME_ALIAS[tip.name] ?? tip.name}</div>
            {tip.c && tip.c.median != null ? (
              <>
                <div className="tnum mt-1 text-ink">{eur(tip.c.median)} <span className="text-ink-faint">median · n={tip.c.n}</span></div>
                {showTop && tip.c.topPayers.length > 0 && (
                  <ul className="mt-2 space-y-0.5 border-t pt-2 text-xs" style={{ borderColor: "var(--border)" }}>
                    {tip.c.topPayers.map((p) => (
                      <li key={p.company} className="flex justify-between gap-2">
                        <span className="truncate text-ink-muted">{p.company}</span>
                        <span className="tnum shrink-0">{eur(p.median)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <div className="mt-1 text-xs text-ink-faint">No data yet{tip.c ? ` · n=${tip.c.n}` : ""}</div>
            )}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
        <span className="text-[11px] uppercase tracking-wider text-ink-faint">vs EMEA median</span>
        <PayScaleLegend />
        <span className="flex items-center gap-1.5 text-[11px]">
          <i className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: NO_DATA_FILL }} />
          <span className="text-ink">No data yet</span>
        </span>
      </div>
    </div>
  );
}
