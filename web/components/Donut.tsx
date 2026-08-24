// Donut chart from real counts, teal-tint palette. Server-rendered SVG with a
// legend. Caller decides when to use it vs a bar list (e.g. when "Other" > 40%).
const PALETTE = ["#0F766E", "#1E9E6A", "#3AA99A", "#6FBFB0", "#9AD1C6", "#C7E3DD", "#D5D2CA"];

export function Donut({
  segments, size = 168, centerLabel, centerSub,
}: {
  segments: { label: string; value: number }[];
  size?: number; centerLabel?: string; centerSub?: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const R = size / 2, r = R * 0.62, cx = R, cy = R;
  let acc = 0;
  const arcs = segments.map((s, i) => {
    const a0 = (acc / total) * 2 * Math.PI - Math.PI / 2;
    acc += s.value;
    const a1 = (acc / total) * 2 * Math.PI - Math.PI / 2;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const p = (ang: number, rad: number) => [cx + rad * Math.cos(ang), cy + rad * Math.sin(ang)];
    const [x0, y0] = p(a0, R), [x1, y1] = p(a1, R), [x2, y2] = p(a1, r), [x3, y3] = p(a0, r);
    const d = `M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${R} ${R} 0 ${large} 1 ${x1.toFixed(1)} ${y1.toFixed(1)} L ${x2.toFixed(1)} ${y2.toFixed(1)} A ${r} ${r} 0 ${large} 0 ${x3.toFixed(1)} ${y3.toFixed(1)} Z`;
    return { d, color: PALETTE[i % PALETTE.length], label: s.label, value: s.value, pct: Math.round((s.value / total) * 100) };
  });
  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="shrink-0" role="img" aria-label="Role distribution">
        {arcs.map((a, i) => <path key={i} d={a.d} fill={a.color} />)}
        {centerLabel && <text x={cx} y={cy - 2} textAnchor="middle" className="tnum" fontSize="20" fontWeight="600" fill="var(--ink)">{centerLabel}</text>}
        {centerSub && <text x={cx} y={cy + 15} textAnchor="middle" fontSize="10" fill="var(--ink-faint)">{centerSub}</text>}
      </svg>
      <ul className="flex-1 space-y-1.5 text-sm">
        {arcs.map((a, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: a.color }} />
            <span className="flex-1 truncate text-ink-muted">{a.label}</span>
            <span className="tnum text-ink">{a.pct}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
