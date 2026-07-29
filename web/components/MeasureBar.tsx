import { Spread } from "@/lib/stats";
import { eurK } from "@/lib/format";

// P10–P90 measure bar. Gradient median marker (glowing). Optional YOU marker
// colored ember (below median) or mint (above median).
export function MeasureBar({
  spread, you,
}: { spread: Spread; you?: number | null }) {
  const lo = spread.p10;
  const hi = spread.p90;
  const span = Math.max(hi - lo, 1);
  const clamp = (v: number) => Math.max(0, Math.min(100, ((v - lo) / span) * 100));

  const medianPos = clamp(spread.median);
  const iqrLeft = clamp(spread.p25);
  const iqrRight = clamp(spread.p75);
  const youBelow = you != null && you < spread.median;
  const youColor = youBelow ? "var(--ember)" : "var(--mint)";
  const youPos = you != null ? clamp(you) : null;

  return (
    <div className="pt-8 pb-7">
      <div className="relative h-3 rounded-full" style={{ background: "var(--surface-3)", border: "1px solid var(--border)" }}>
        {/* IQR band */}
        <div
          className="absolute top-0 bottom-0 rounded-full"
          style={{ left: `${iqrLeft}%`, right: `${100 - iqrRight}%`, background: "rgba(124,108,255,.28)" }}
        />
        {/* median marker */}
        <div className="absolute -top-1.5 -bottom-1.5" style={{ left: `calc(${medianPos}% - 2px)` }}>
          <div className="h-full w-1 rounded-full gradient-bg" style={{ boxShadow: "var(--shadow-marker,0 0 18px 2px rgba(124,108,255,.55))" }} />
        </div>
        {/* YOU marker */}
        {youPos != null && (
          <div className="absolute -top-2.5 -bottom-2.5" style={{ left: `calc(${youPos}% - 2px)` }}>
            <div className="h-full w-1 rounded-full" style={{ background: youColor, boxShadow: `0 0 16px 2px ${youColor}` }} />
          </div>
        )}
      </div>

      {/* scale labels */}
      <div className="tnum mt-3 flex justify-between text-xs text-ink-faint">
        <span>{eurK(lo)}<span className="ml-1 text-[10px] uppercase tracking-wide">P10</span></span>
        <span className="text-ink-muted">{eurK(spread.median)} median</span>
        <span>{eurK(hi)}<span className="ml-1 text-[10px] uppercase tracking-wide">P90</span></span>
      </div>

      {youPos != null && (
        <div className="tnum mt-2 text-center text-xs" style={{ color: youColor }}>
          you · {eurK(you!)}
        </div>
      )}
    </div>
  );
}
