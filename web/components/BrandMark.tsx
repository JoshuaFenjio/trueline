// SalaryRadar mark: an open compass — teal ring + clean two-tone N/S needle,
// NO filled square behind it. Our teal (#0F766E), not the reference's brighter
// green. Kept in sync with app/icon.svg (favicon), the OG template, and the
// email template's inline mark. Legible down to a 16px favicon (bold ring +
// solid needle; the faint south half still reads as a needle at small sizes).
export function BrandMark({ size = 22, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden="true" focusable="false">
      <circle cx="16" cy="16" r="12" fill="none" stroke="#0F766E" strokeWidth="2.75" />
      <path d="M16 5.5 L18.6 16 L13.4 16 Z" fill="#0F766E" />
      <path d="M16 26.5 L18.6 16 L13.4 16 Z" fill="#0F766E" opacity="0.42" />
      <circle cx="16" cy="16" r="1.8" fill="#0F766E" />
    </svg>
  );
}
