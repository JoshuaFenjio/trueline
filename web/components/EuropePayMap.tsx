"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import topo from "@/lib/europe.topo.json";
import type { EuropePayData, CountryPay } from "@/lib/data";
import { payColor, scoreFromRatio, NO_DATA_FILL } from "@/lib/payScale";
import { PayScaleLegend } from "@/components/PayIndex";
import { eur, slugify } from "@/lib/format";

// topojson NAME -> our canonical country name
const NAME_ALIAS: Record<string, string> = { "Czech Republic": "Czechia" };

export interface Fact { label: string; value: string }

export function EuropePayMap({
  data, initialRole = "All roles", highlightCountry, withTable = false, facts,
}: {
  data: EuropePayData; initialRole?: string; highlightCountry?: string | null;
  withTable?: boolean; facts?: Fact[];
}) {
  const [mounted, setMounted] = useState(false);
  const [role, setRole] = useState(data.data[initialRole] ? initialRole : "All roles");
  const [showTop, setShowTop] = useState(false);
  const [tip, setTip] = useState<{ x: number; y: number; name: string; c: CountryPay | null } | null>(null);
  const router = useRouter();
  useEffect(() => setMounted(true), []);

  const rp = data.data[role] ?? data.data["All roles"];
  const byCountry = useMemo(() => new Map(rp.countries.map((c) => [c.country, c])), [rp]);
  const lookup = (name: string): CountryPay | null => byCountry.get(NAME_ALIAS[name] ?? name) ?? null;
  const highlight = highlightCountry || null;

  const controls = (
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
  );

  const mapEl = (
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
                const isHi = highlight != null && c?.country === highlight;
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
                      default: { fill, stroke: isHi ? "var(--ink)" : "var(--bg)", strokeWidth: isHi ? 1.6 : 0.6, outline: "none", cursor: c ? "pointer" : "default" },
                      hover: { fill, stroke: "var(--ink)", strokeWidth: 1, outline: "none", filter: "brightness(0.94)" },
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

      {tip && (
        <div
          className="pointer-events-none absolute z-20 w-56 rounded-xl border p-3 text-sm shadow-glow"
          style={{ left: Math.min(tip.x + 12, 560), top: tip.y + 12, background: "#fff", borderColor: "var(--border)" }}
        >
          <div className="font-semibold">{tip.c?.country ?? NAME_ALIAS[tip.name] ?? tip.name}</div>
          {tip.c && tip.c.median != null ? (
            <>
              <div className="tnum mt-1 text-ink">{eur(tip.c.median)} <span className="text-ink-faint">median · n={tip.c.n}</span></div>
              {tip.c.concentration && tip.c.concentration.share > 0.6 && (
                <div className="mt-0.5 text-[11px] text-ink-faint">mostly {tip.c.concentration.company}</div>
              )}
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
  );

  const legendEl = (
    <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
      <span className="text-[11px] uppercase tracking-wider text-ink-faint">vs EMEA median</span>
      <PayScaleLegend />
      <span className="flex items-center gap-1.5 text-[11px]">
        <i className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: NO_DATA_FILL }} />
        <span className="text-ink">No data yet</span>
      </span>
    </div>
  );

  if (!withTable) {
    return <div>{controls}{mapEl}{legendEl}</div>;
  }

  // Table-beside-map: ranked country table (always visible) + map (lg+ only).
  const ranked = [...rp.countries].filter((c) => c.median != null).sort((a, b) => b.median! - a.median!);
  const maxMed = Math.max(1, ...ranked.map((c) => c.median!));
  return (
    <div>
      {facts && facts.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-x-8 gap-y-3">
          {facts.map((f) => (
            <div key={f.label}>
              <div className="tnum text-lg font-semibold">{f.value}</div>
              <div className="text-[11px] uppercase tracking-wider text-ink-faint">{f.label}</div>
            </div>
          ))}
        </div>
      )}
      {controls}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="surface overflow-hidden rounded-card">
          <div className="tnum flex items-center gap-3 border-b px-4 py-2.5 text-[11px] uppercase tracking-wider text-ink-faint" style={{ borderColor: "var(--border)" }}>
            <span className="w-5 text-right">#</span><span className="flex-1">Country</span>
            <span className="w-24 text-right">Median</span><span className="hidden w-12 text-right sm:block">n</span>
          </div>
          <ol>
            {ranked.map((c, i) => (
              <li key={c.country} className="border-t" style={{ borderColor: "var(--border)" }}>
                <Link href={`/locations/country/${slugify(c.country)}`} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[var(--surface-1)]" style={{ background: c.country === highlight ? "var(--accent-soft)" : undefined }}>
                  <span className="tnum w-5 text-right text-sm text-ink-faint">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="truncate">{c.country}</span>
                    {c.concentration && c.concentration.share > 0.6 && <span className="ml-2 text-xs text-ink-faint">mostly {c.concentration.company}</span>}
                    <span className="relative mt-1.5 block h-1.5 overflow-hidden rounded-full" style={{ background: "var(--surface-3)" }}>
                      <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(c.median! / maxMed) * 100}%`, background: payColor(scoreFromRatio(c.median!, rp.emeaMedian)) }} />
                    </span>
                  </span>
                  <span className="tnum w-24 text-right font-semibold">{eur(c.median!)}</span>
                  <span className="tnum hidden w-12 text-right text-sm text-ink-faint sm:block">{c.n}</span>
                </Link>
              </li>
            ))}
            {ranked.length === 0 && <li className="px-4 py-6 text-sm text-ink-faint">No country clears the 8-posting gate for this role yet.</li>}
          </ol>
        </div>
        <div className="hidden lg:block">{mapEl}{legendEl}</div>
      </div>
    </div>
  );
}
