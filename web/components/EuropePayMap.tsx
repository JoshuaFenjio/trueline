"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import topo from "@/lib/europe.topo.json";
import type { EuropePayData, CountryPay, CountryFinding } from "@/lib/data";
import { payColor, scoreFromRatio, NO_DATA_FILL } from "@/lib/payScale";
import { PayScaleLegend } from "@/components/PayIndex";
import { Sparkline } from "@/components/Sparkline";
import { eur, slugify } from "@/lib/format";

// topojson NAME -> our canonical country name
const NAME_ALIAS: Record<string, string> = { "Czech Republic": "Czechia" };

export interface Fact { label: string; value: string }

export function EuropePayMap({
  data, initialRole = "All roles", highlightCountry, withTable = false, facts,
  triptych = false, findings, spark,
}: {
  data: EuropePayData; initialRole?: string; highlightCountry?: string | null;
  withTable?: boolean; facts?: Fact[];
  triptych?: boolean; findings?: Record<string, CountryFinding | null>; spark?: number[];
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
    <div className="mb-5 flex flex-wrap items-center gap-3">
      <label className="text-[11px] text-ink-faint">Role</label>
      <select value={role} onChange={(e) => setRole(e.target.value)} className="filter-pill">
        <option>All roles</option>
        {data.roles.map((r) => <option key={r}>{r}</option>)}
      </select>
      <button
        onClick={() => setShowTop((v) => !v)}
        className="filter-pill"
        style={showTop ? { borderColor: "var(--accent)", color: "var(--accent)" } : undefined}
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
      <span className="text-[11px] text-ink-faint">vs EMEA median</span>
      <PayScaleLegend />
      <span className="flex items-center gap-1.5 text-[11px]">
        <i className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: NO_DATA_FILL }} />
        <span className="text-ink">No data yet</span>
      </span>
    </div>
  );

  if (!withTable && !triptych) {
    return <div>{controls}{mapEl}{legendEl}</div>;
  }

  // Table-beside-map: ranked country table (always visible) + map (lg+ only).
  const ranked = [...rp.countries].filter((c) => c.median != null).sort((a, b) => b.median! - a.median!);
  const maxMed = Math.max(1, ...ranked.map((c) => c.median!));

  // Compact ranked table (used in the triptych left column).
  const tableEl = (
    <div className="card overflow-hidden !p-0">
      <div className="flex items-center gap-3 border-b px-4 py-2.5 text-[12px] text-ink-faint" style={{ borderColor: "var(--border)" }}>
        <span className="w-5 text-right">#</span><span className="flex-1">Country</span>
        <span className="w-20 text-right">Median</span>
      </div>
      <ol>
        {ranked.slice(0, 12).map((c, i) => (
          <li key={c.country} className="border-t" style={{ borderColor: "var(--border)" }}>
            <Link href={`/locations/country/${slugify(c.country)}`} className="flex items-center gap-3 px-4 py-2 transition-colors hover:bg-[var(--band)]" style={{ background: c.country === highlight ? "var(--accent-soft)" : undefined }}>
              <span className="tnum w-5 text-right text-sm text-ink-faint">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="text-sm">{c.country}</span>
                <span className="tnum ml-2 text-[11px] text-ink-faint">n={c.n}</span>
                <span className="rank-track mt-1.5 block">
                  <span className="rank-fill" style={{ width: `${(c.median! / maxMed) * 100}%`, background: payColor(scoreFromRatio(c.median!, rp.emeaMedian)) }} />
                </span>
              </span>
              <span className="tnum w-20 text-right text-sm font-semibold">{eur(c.median!)}</span>
            </Link>
          </li>
        ))}
        {ranked.length === 0 && <li className="px-4 py-6 text-sm text-ink-faint">No country clears the 8-posting gate for this role yet.</li>}
      </ol>
      <Link href="/locations/countries" className="arrow-link flex items-center justify-center gap-1 border-t px-4 py-2.5 text-xs" style={{ borderColor: "var(--border)" }}>
        View all countries <span className="arw">→</span>
      </Link>
    </div>
  );

  // Legend as a row of coloured dots (sits under the map on the band).
  const dotsLegend = (
    <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
      <span className="text-[11px] text-ink-faint">vs EMEA median</span>
      <PayScaleLegend />
      <span className="flex items-center gap-1.5 text-[11px]">
        <i className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: NO_DATA_FILL }} />
        <span className="text-ink">No data yet</span>
      </span>
    </div>
  );

  // Insight card — reactive to the role selector. Finding is computed at build
  // time (top country vs EMEA median) and passed in via `findings`.
  const finding = findings?.[role] ?? null;
  const insightEl = (
    <div className="card-float flex h-full flex-col p-5">
      <div className="eyebrow">Insight</div>
      {spark && spark.length >= 2 && (
        <div className="mt-3"><Sparkline values={spark} width={220} height={36} className="w-full" /></div>
      )}
      {finding ? (
        <>
          <p className="mt-4 text-lg font-semibold leading-snug">
            {finding.country} pays{" "}
            <span className="tnum" style={{ color: finding.deltaPct >= 0 ? "var(--mint)" : "var(--ember)" }}>
              {finding.deltaPct >= 0 ? "+" : ""}{finding.deltaPct}%
            </span>{" "}
            {finding.deltaPct >= 0 ? "above" : "below"} the EMEA median for {role === "All roles" ? "all roles" : role}.
          </p>
          <p className="mt-2 text-sm text-ink-muted">
            Median <span className="tnum text-ink">{eur(finding.median)}</span> base here versus{" "}
            <span className="tnum text-ink">{eur(rp.emeaMedian)}</span> across EMEA.
          </p>
          <p className="mt-1 text-sm text-ink-muted">From <span className="tnum text-ink">{finding.n}</span> salaried postings that clear the gate.</p>
          <div className="mt-5">
            <Link href={`/locations/country/${finding.slug}`} className="pill-btn">
              <span>Explore {finding.country}</span><span className="arw">→</span>
            </Link>
          </div>
        </>
      ) : (
        <p className="mt-4 text-sm text-ink-muted">Not enough data to name a leader for {role === "All roles" ? "all roles" : role} yet. We show one at the 8-posting gate.</p>
      )}
    </div>
  );

  if (triptych) {
    return (
      <div>
        {controls}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.25fr)_minmax(0,0.85fr)] lg:items-start">
          <div>{tableEl}</div>
          {/* map sits directly on the band, no card */}
          <div className="hidden min-h-[420px] lg:block">{mapEl}{dotsLegend}</div>
          <div>{insightEl}</div>
        </div>
      </div>
    );
  }
  return (
    <div>
      {facts && facts.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-x-8 gap-y-3">
          {facts.map((f) => (
            <div key={f.label}>
              <div className="tnum text-lg font-semibold">{f.value}</div>
              <div className="text-[11px] text-ink-faint">{f.label}</div>
            </div>
          ))}
        </div>
      )}
      {controls}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="surface overflow-hidden rounded-card">
          <div className="flex items-center gap-3 border-b px-4 py-2.5 text-[11px] text-ink-faint" style={{ borderColor: "var(--border)" }}>
            <span className="w-5 text-right">#</span><span className="flex-1">Country</span>
            <span className="w-24 text-right">Median</span><span className="hidden w-12 text-right sm:block">n</span>
          </div>
          <ol>
            {ranked.map((c, i) => (
              <li key={c.country} className="border-t" style={{ borderColor: "var(--border)" }}>
                <Link href={`/locations/country/${slugify(c.country)}`} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[var(--band)]" style={{ background: c.country === highlight ? "var(--accent-soft)" : undefined }}>
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
