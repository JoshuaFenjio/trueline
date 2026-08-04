"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { MapCity } from "@/lib/data";

const W = 760, H = 520;
// EMEA-ish bounding box (covers London → Dubai/Tel Aviv, down to Cairo).
const LON_MIN = -11, LON_MAX = 56, LAT_MIN = 23, LAT_MAX = 64;
const proj = (lat: number, lon: number) => ({
  x: ((lon - LON_MIN) / (LON_MAX - LON_MIN)) * W,
  y: ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * H,
});
function tone(median: number, emea: number): string {
  const r = emea ? median / emea : 1;
  if (r >= 1.08) return "#4ADE9C"; // above EMEA median
  if (r <= 0.92) return "#FF6A45"; // below
  return "#5E8BFF"; // ~market
}
function eurK(n: number) { return "€" + Math.round(n / 1000) + "k"; }

export function EmeaMap({ cities, emeaMedian }: { cities: MapCity[]; emeaMedian: number }) {
  const router = useRouter();
  const [hover, setHover] = useState<MapCity | null>(null);
  const maxN = Math.max(1, ...cities.map((c) => c.n));

  return (
    <div>
      {/* Map (hidden on small screens) */}
      <div className="surface relative hidden rounded-card p-3 md:block">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="EMEA salary map">
          {/* faint graticule */}
          {[0, 0.25, 0.5, 0.75, 1].map((f) => (
            <g key={f} stroke="var(--border)" strokeWidth={1}>
              <line x1={f * W} y1={0} x2={f * W} y2={H} />
              <line x1={0} y1={f * H} x2={W} y2={f * H} />
            </g>
          ))}
          {cities.map((c) => {
            const { x, y } = proj(c.lat, c.lon);
            const r = Math.min(22, 4 + Math.sqrt(c.n / maxN) * 20);
            const col = tone(c.median, emeaMedian);
            const on = hover?.slug === c.slug;
            return (
              <circle
                key={c.slug}
                cx={x} cy={y} r={r}
                fill={col} fillOpacity={on ? 0.85 : 0.45}
                stroke={col} strokeWidth={on ? 2 : 1}
                style={{ cursor: "pointer", filter: on ? `drop-shadow(0 0 8px ${col})` : "none" }}
                onMouseEnter={() => setHover(c)}
                onMouseLeave={() => setHover((h) => (h?.slug === c.slug ? null : h))}
                onClick={() => router.push(`/locations/${c.slug}`)}
              />
            );
          })}
        </svg>

        {hover && (() => {
          const { x, y } = proj(hover.lat, hover.lon);
          return (
            <div
              className="surface pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border px-3 py-2 text-xs shadow-glow"
              style={{ left: `${(x / W) * 100}%`, top: `calc(${(y / H) * 100}% - 10px)` }}
            >
              <div className="font-medium">{hover.city}</div>
              <div className="tnum mt-0.5 text-ink-muted">{eurK(hover.median)} median · {hover.n} roles</div>
            </div>
          );
        })()}

        <div className="tnum mt-1 flex items-center gap-4 px-1 text-[10px] uppercase tracking-wider text-ink-faint">
          <span className="flex items-center gap-1"><Dot c="#4ADE9C" /> above EMEA median</span>
          <span className="flex items-center gap-1"><Dot c="#5E8BFF" /> ~market</span>
          <span className="flex items-center gap-1"><Dot c="#FF6A45" /> below</span>
          <span className="ml-auto">size = salaried roles · EMEA median {eurK(emeaMedian)}</span>
        </div>
      </div>

      {/* Mobile fallback: top-cities list */}
      <div className="md:hidden">
        <ul className="surface divide-y overflow-hidden rounded-card" style={{ borderColor: "var(--border)" }}>
          {cities.slice(0, 12).map((c) => (
            <li key={c.slug}>
              <a href={`/locations/${c.slug}`} className="flex items-center justify-between px-4 py-3">
                <span className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: tone(c.median, emeaMedian) }} />
                  {c.city}
                </span>
                <span className="tnum text-ink-muted">{eurK(c.median)} · {c.n}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Dot({ c }: { c: string }) {
  return <span className="inline-block h-2 w-2 rounded-full" style={{ background: c }} />;
}
