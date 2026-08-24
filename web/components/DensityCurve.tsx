import { eurK } from "@/lib/format";
import type { Spread } from "@/lib/stats";

// Kernel-density salary distribution curve, built from real salaried datapoints.
// Gaussian KDE (Silverman bandwidth), filled teal area, with P10/P25/median/
// P75/P90 markers. Server-rendered SVG. Only render when n>=20 (caller gates).
export function DensityCurve({ values, spread, height = 240 }: { values: number[]; spread: Spread; height?: number }) {
  const W = 720, H = height, padB = 34, padT = 12;
  const lo = Math.min(values[0], spread.p10);
  const hi = Math.max(values[values.length - 1], spread.p90);
  const span = hi - lo || 1;
  const x0 = lo - span * 0.05, x1 = hi + span * 0.05;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  const std = Math.sqrt(variance) || span / 6;
  const h = 1.06 * std * Math.pow(values.length, -1 / 5) || span / 10;
  const N = 72;
  const xs = Array.from({ length: N }, (_, i) => x0 + (i / (N - 1)) * (x1 - x0));
  const dens = xs.map((x) => values.reduce((s, v) => s + Math.exp(-0.5 * ((x - v) / h) ** 2), 0) / (values.length * h * Math.sqrt(2 * Math.PI)));
  const maxD = Math.max(...dens) || 1;
  const px = (x: number) => ((x - x0) / (x1 - x0)) * W;
  const py = (d: number) => padT + (1 - d / maxD) * (H - padB - padT);
  const pts = xs.map((x, i) => `${px(x).toFixed(1)},${py(dens[i]).toFixed(1)}`);
  const line = `M ${pts.join(" L ")}`;
  const area = `${line} L ${W},${H - padB} L 0,${H - padB} Z`;

  const marks: { label: string; v: number }[] = [
    { label: "P10", v: spread.p10 }, { label: "P25", v: spread.p25 },
    { label: "Median", v: spread.median }, { label: "P75", v: spread.p75 }, { label: "P90", v: spread.p90 },
  ];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Salary distribution curve">
      <defs>
        <linearGradient id="dens-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#dens-fill)" />
      <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />
      {marks.map((m) => {
        const x = px(m.v);
        const isMed = m.label === "Median";
        return (
          <g key={m.label}>
            <line x1={x} y1={padT} x2={x} y2={H - padB} stroke={isMed ? "var(--ink)" : "var(--border-strong)"} strokeWidth={isMed ? 1.4 : 1} strokeDasharray={isMed ? undefined : "3 3"} />
            <text x={x} y={H - padB + 13} textAnchor="middle" className="tnum" fontSize="10" fill="var(--ink-faint)">{m.label}</text>
            <text x={x} y={H - padB + 25} textAnchor="middle" className="tnum" fontSize="10" fill={isMed ? "var(--ink)" : "var(--ink-muted)"} fontWeight={isMed ? 600 : 400}>{eurK(m.v)}</text>
          </g>
        );
      })}
    </svg>
  );
}
