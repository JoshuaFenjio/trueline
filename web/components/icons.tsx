// Single consistent inline-SVG icon set (lucide-style, 24x24, currentColor
// stroke). Teal/ink only via the consuming element's text color. Reused across
// every redesigned page — no icon libraries, no emoji-as-icon.
import type { SVGProps } from "react";

function Base({ children, size = 18, ...rest }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      {children}
    </svg>
  );
}

export const Icon = {
  trophy: (p: { size?: number; className?: string }) => <Base {...p}><path d="M6 4h12v3a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V4Z" /><path d="M6 5H4a2 2 0 0 0 0 4h1M18 5h2a2 2 0 0 1 0 4h-1M9 15h6M10 15v3M14 15v3M8 21h8" /></Base>,
  layers: (p: { size?: number; className?: string }) => <Base {...p}><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 13 9 5 9-5M3 8v0" /></Base>,
  briefcase: (p: { size?: number; className?: string }) => <Base {...p}><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18" /></Base>,
  globe: (p: { size?: number; className?: string }) => <Base {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" /></Base>,
  shield: (p: { size?: number; className?: string }) => <Base {...p}><path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" /><path d="m9 12 2 2 4-4" /></Base>,
  eye: (p: { size?: number; className?: string }) => <Base {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="2.5" /></Base>,
  check: (p: { size?: number; className?: string }) => <Base {...p}><path d="m4 12 5 5L20 6" /></Base>,
  pin: (p: { size?: number; className?: string }) => <Base {...p}><path d="M12 21c4-4.5 7-7.5 7-11a7 7 0 1 0-14 0c0 3.5 3 6.5 7 11Z" /><circle cx="12" cy="10" r="2.5" /></Base>,
  building: (p: { size?: number; className?: string }) => <Base {...p}><rect x="4" y="3" width="16" height="18" rx="1.5" /><path d="M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1M10 21v-3h4v3" /></Base>,
  trending: (p: { size?: number; className?: string }) => <Base {...p}><path d="m3 17 6-6 4 4 8-8" /><path d="M17 7h4v4" /></Base>,
  refresh: (p: { size?: number; className?: string }) => <Base {...p}><path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5" /></Base>,
  bars: (p: { size?: number; className?: string }) => <Base {...p}><path d="M3 21V10M9 21V4M15 21v-8M21 21V7" /></Base>,
  users: (p: { size?: number; className?: string }) => <Base {...p}><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0M16 5.5a3 3 0 0 1 0 5M21 20a6 6 0 0 0-4-5.6" /></Base>,
  scale: (p: { size?: number; className?: string }) => <Base {...p}><path d="M12 3v18M7 21h10M6 6l-3 6a3 3 0 0 0 6 0L6 6ZM18 6l-3 6a3 3 0 0 0 6 0l-3-6ZM4 6h16" /></Base>,
  arrow: (p: { size?: number; className?: string }) => <Base {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Base>,
  search: (p: { size?: number; className?: string }) => <Base {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Base>,
  target: (p: { size?: number; className?: string }) => <Base {...p}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="0.5" /></Base>,
  spark: (p: { size?: number; className?: string }) => <Base {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" /></Base>,
  code: (p: { size?: number; className?: string }) => <Base {...p}><path d="m8 7-5 5 5 5M16 7l5 5-5 5" /></Base>,
  doc: (p: { size?: number; className?: string }) => <Base {...p}><path d="M6 2h8l4 4v16H6V2Z" /><path d="M14 2v4h4M9 13h6M9 17h6M9 9h2" /></Base>,
};
export type IconName = keyof typeof Icon;
