"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps";
import topo from "@/lib/europe.topo.json";
import type { CompanyDetail } from "@/lib/data";
import type { PostingVM } from "@/lib/postings";
import { NO_DATA_FILL } from "@/lib/payScale";
import { PostingList } from "@/components/PostingList";
import { Flag } from "@/components/Flag";
import { Icon } from "@/components/icons";
import { eur, slugify } from "@/lib/format";

const NAME_ALIAS: Record<string, string> = { "Czech Republic": "Czechia" };
type Market = CompanyDetail["markets"][number];

/**
 * "Where [Company] hires" — Europe shaded by this company's active-ad count per
 * country, office cities dotted, beside a ranked markets list.
 *
 * Clicking a market opens THIS COMPANY's live ads in that country, in place. It
 * used to link to the generic country page, which dropped the company and
 * answered a question nobody asked ("what does everyone pay in Germany?"). The
 * generic page is still one click away from the panel.
 */
export function CompanyHiresMap({
  company, markets, offices, postingsByCountry, alsoOperates = [],
}: {
  company: string;
  markets: CompanyDetail["markets"];
  offices: CompanyDetail["offices"];
  postingsByCountry?: Record<string, PostingVM[]>;
  alsoOperates?: string[];
}) {
  const [mounted, setMounted] = useState(false);
  const [tip, setTip] = useState<{ x: number; y: number; name: string; m: Market | null } | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  useEffect(() => setMounted(true), []);

  const byCountry = useMemo(() => new Map(markets.map((m) => [m.country, m])), [markets]);
  const max = Math.max(1, ...markets.map((m) => m.postings));
  const lookup = (name: string): Market | null => byCountry.get(NAME_ALIAS[name] ?? name) ?? null;
  const fillFor = (m: Market | null) => (m ? `rgba(15,118,110,${(0.2 + 0.75 * (m.postings / max)).toFixed(3)})` : NO_DATA_FILL);

  const sel = picked ? byCountry.get(picked) ?? null : null;
  const selPosts = picked ? postingsByCountry?.[picked] ?? [] : [];

  const mapEl = (
    <div className="relative">
      {mounted ? (
        <ComposableMap projection="geoAzimuthalEqualArea" projectionConfig={{ rotate: [-10, -53, 0], scale: 950 }} width={800} height={600} style={{ width: "100%", height: "auto" }}>
          <Geographies geography={topo as any}>
            {({ geographies }: any) => geographies.map((geo: any) => {
              const name = geo.properties.NAME as string;
              const m = lookup(name);
              const isSel = !!m && m.country === picked;
              return (
                <Geography
                  key={geo.rsmKey} geography={geo}
                  onMouseMove={(e: any) => {
                    const box = (e.currentTarget.ownerSVGElement.parentElement as HTMLElement).getBoundingClientRect();
                    setTip({ x: e.clientX - box.left, y: e.clientY - box.top, name, m });
                  }}
                  onMouseLeave={() => setTip(null)}
                  onClick={() => m && setPicked((p) => (p === m.country ? null : m.country))}
                  style={{
                    default: { fill: fillFor(m), stroke: isSel ? "var(--ink)" : "var(--bg)", strokeWidth: isSel ? 1.6 : 0.6, outline: "none", cursor: m ? "pointer" : "default" },
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
          <div className="tnum mt-1 text-ink">{tip.m.postings} live job ad{tip.m.postings === 1 ? "" : "s"}</div>
          <div className="tnum text-xs text-ink-faint">{tip.m.median != null ? `${eur(tip.m.median)} median base` : "median needs 3+ salaried ads"}</div>
        </div>
      )}
    </div>
  );

  return (
    <div>
      {sel && (
        <div className="card mb-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Flag country={sel.country} />
              <div>
                <div className="text-[15px] font-semibold">{company} in {sel.country}</div>
                <div className="tnum text-[12px] text-ink-faint">
                  {sel.postings} live job ad{sel.postings === 1 ? "" : "s"} · {sel.salaried} disclose pay
                  {sel.median != null ? ` · ${eur(sel.median)} median base` : " · median needs 3+ salaried ads"}
                </div>
              </div>
            </div>
            <button type="button" onClick={() => setPicked(null)} className="text-[12px] text-ink-muted transition-colors hover:text-ink">Clear ✕</button>
          </div>
          <div className="mt-4">
            <PostingList postings={selPosts} sortable emptyNote={`No dated ${company} ads in ${sel.country} right now.`} />
          </div>
          <div className="mt-4">
            <Link href={`/locations/country/${slugify(sel.country)}`} className="arrow-link inline-flex items-center gap-1 text-xs">
              <span>All employers in {sel.country}</span><span className="arw">→</span>
            </Link>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="surface overflow-hidden rounded-card">
          <div className="flex items-center gap-3 border-b px-4 py-2.5 text-[11px] text-ink-faint" style={{ borderColor: "var(--border)" }}>
            <span className="w-[22px] shrink-0" />
            <span className="min-w-0 flex-1">Market</span>
            <span className="w-20 shrink-0 text-right">Live job ads</span>
            <span className="w-24 shrink-0 text-right">Median base</span>
          </div>
          <ol>
            {markets.map((m) => (
              <li key={m.country} className="border-t" style={{ borderColor: "var(--border)" }}>
                <button
                  type="button"
                  onClick={() => setPicked((p) => (p === m.country ? null : m.country))}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[var(--band)]"
                  style={{ background: m.country === picked ? "var(--accent-soft)" : undefined }}
                >
                  <Flag country={m.country} />
                  <span className="min-w-0 flex-1 truncate">{m.country}</span>
                  <span className="tnum w-20 shrink-0 text-right">{m.postings}</span>
                  <span className="tnum w-24 shrink-0 text-right text-ink-muted">{m.median != null ? eur(m.median) : "—"}</span>
                </button>
              </li>
            ))}
            {markets.length === 0 && <li className="px-4 py-6 text-sm text-ink-faint">No located job ads yet.</li>}
          </ol>
          <div className="border-t px-4 py-2.5 text-[11px] text-ink-faint" style={{ borderColor: "var(--border)" }}>
            Click a market for {company}&rsquo;s live ads there.
          </div>
        </div>
        <div className="hidden lg:block">
          {mapEl}
          <div className="tnum mt-3 flex items-center gap-4 text-[11px] text-ink-faint">
            <span className="flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: "rgba(15,118,110,0.85)" }} /> more live job ads</span>
            <span className="flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-full" style={{ background: "var(--ink)" }} /> office city</span>
          </div>
        </div>
      </div>

      {/* Scope, stated plainly: we only track EMEA ads, so a US-headquartered
          employer would otherwise look like it exists only in Europe. */}
      <div className="mt-4 flex flex-wrap items-start gap-2 text-[12px] text-ink-faint">
        <span className="shrink-0 text-[var(--accent)]"><Icon.globe size={14} /></span>
        <p className="max-w-prose">
          We track job ads in Europe, the Middle East and Africa only — markets outside EMEA are not benchmarked here
          {alsoOperates.length > 0 ? (
            <>
              . {company} also names <span className="text-ink">{alsoOperates.join(", ")}</span> in its own
              multi-location ads, so it operates there too; we have no pay data for those markets.
            </>
          ) : "."}
        </p>
      </div>
    </div>
  );
}
