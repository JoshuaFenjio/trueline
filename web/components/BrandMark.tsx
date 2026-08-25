// SalaryRadar mark: a compass/radar — ink rounded square, teal ring + two-tone
// compass-rose needle (our #0F766E on #171614). Geometry only is borrowed from
// brand-reference.png; its fonts/greens are not. Kept in sync with app/icon.svg
// (favicon) and the OG template's inline mark.
export function BrandMark({ size = 22, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="8" fill="#171614" />
      <circle cx="16" cy="16" r="9" fill="none" stroke="#0F766E" strokeWidth="2" />
      <g transform="rotate(45 16 16)">
        <path d="M16 7 L18.2 16 L16 25 L13.8 16 Z" fill="#0F766E" />
        <path d="M7 16 L16 13.8 L25 16 L16 18.2 Z" fill="#0F766E" opacity="0.5" />
      </g>
      <circle cx="16" cy="16" r="1.6" fill="#171614" />
    </svg>
  );
}
