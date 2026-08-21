import Link from "next/link";
import { eur } from "@/lib/format";
import { Sparkline } from "@/components/Sparkline";
import type { HomeComposition } from "@/lib/data";

// The hero's right-column composition: a soft tinted panel holding four white
// cards on a deliberate 4x4 grid. Every figure is live (see getHomeComposition).
// A card whose data gate isn't met is dropped and the remaining cards fill the
// strongest slots; the decorative glyph is pinned to the small slot.
//
// Slot order = visual priority. Data cards fill 1→3 (skipping nulls); the glyph
// always takes slot 4 (top-right square).
const SLOTS = [
  { gridColumn: "1 / 3", gridRow: "1 / 3" },
  { gridColumn: "3 / 5", gridRow: "2 / 4" },
  { gridColumn: "1 / 3", gridRow: "3 / 5" },
];

export function HeroComposition({ comp }: { comp: HomeComposition }) {
  const cards: React.ReactNode[] = [];

  // a) EMEA median base + sample-size subline + sparkline. We show the sample
  // behind the number (stable, true) rather than a quarter-over-quarter delta,
  // which posted_at is too sparse to support honestly.
  if (comp.emeaMedian > 0) {
    cards.push(
      <div key="median" className="card-float flex h-full flex-col justify-between p-3.5">
        <div className="text-[11px] leading-tight text-ink-faint">EMEA median base salary</div>
        <div>
          <div className="tnum mt-2 text-[20px] font-semibold leading-none">{eur(comp.emeaMedian)}</div>
          <div className="tnum mt-1.5 text-[11px] text-ink-faint">{comp.salaried.toLocaleString()} salaried roles</div>
        </div>
        {comp.spark.length >= 2 && (
          <div className="mt-3 -mb-0.5">
            <Sparkline values={comp.spark} width={140} height={30} className="w-full" />
          </div>
        )}
      </div>
    );
  }

  // b) Top paying city
  if (comp.topCity) {
    cards.push(
      <Link key="city" href={`/locations/${comp.topCity.slug}`} className="card-float card-hover flex h-full flex-col justify-between p-3.5">
        <div className="text-[11px] leading-tight text-ink-faint">Top paying city</div>
        <div className="mt-2">
          <div className="t-h3">{comp.topCity.city}</div>
          <div className="tnum mt-1 text-[15px] font-semibold text-ink">{eur(comp.topCity.median)}</div>
          <div className="tnum mt-0.5 text-[11px] text-ink-faint">median base · n={comp.topCity.n}</div>
        </div>
      </Link>
    );
  }

  // c) In-demand role + live open-role count (no volatile QoQ delta)
  if (comp.inDemandRole) {
    const r = comp.inDemandRole;
    cards.push(
      <Link key="role" href={`/roles/${r.slug}`} className="card-float card-hover flex h-full flex-col justify-between p-3.5">
        <div className="text-[11px] leading-tight text-ink-faint">In-demand role</div>
        <div className="mt-2">
          <div className="t-h3">{r.name}</div>
          <div className="tnum mt-1 text-[11px] text-ink-faint">{r.activeN.toLocaleString()} open roles tracked</div>
        </div>
      </Link>
    );
  }

  return (
    <div
      className="grid aspect-[4/3.4] w-full grid-cols-4 grid-rows-4 gap-3 rounded-[20px] p-4"
      style={{ background: "var(--panel)" }}
    >
      {cards.slice(0, 3).map((c, i) => (
        <div key={i} style={SLOTS[i]} className="min-h-0">{c}</div>
      ))}
      {/* decorative mini bar-chart glyph — pinned to the small top-right square */}
      <div style={{ gridColumn: "4 / 5", gridRow: "1 / 2" }} className="min-h-0">
        <div className="card-float flex h-full items-end justify-center gap-1 p-3" aria-hidden="true">
          <span className="w-1.5 rounded-sm" style={{ height: "38%", background: "var(--border-strong)" }} />
          <span className="w-1.5 rounded-sm" style={{ height: "62%", background: "var(--accent)" }} />
          <span className="w-1.5 rounded-sm" style={{ height: "82%", background: "var(--accent)" }} />
          <span className="w-1.5 rounded-sm" style={{ height: "52%", background: "var(--border-strong)" }} />
        </div>
      </div>
    </div>
  );
}
