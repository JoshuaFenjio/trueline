// Generic teal city skyline silhouette — decorative header motif in place of a
// photo. Single-tone, no outlines, aria-hidden. Anchored to the panel floor.
export function CitySilhouette({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 640 160" preserveAspectRatio="xMidYMax slice" className={className} aria-hidden="true" focusable="false">
      <g fill="var(--accent)" opacity="0.14">
        <rect x="20" y="70" width="46" height="90" /><rect x="80" y="52" width="34" height="108" />
        <rect x="150" y="80" width="40" height="80" /><rect x="210" y="60" width="30" height="100" />
        <rect x="360" y="74" width="44" height="86" /><rect x="430" y="58" width="34" height="102" />
        <rect x="520" y="82" width="46" height="78" /><rect x="580" y="66" width="40" height="94" />
        <path d="M120 160 V64 l14-16 14 16 V160 Z" /><path d="M270 160 V72 a20 20 0 0 1 40 0 V160 Z" />
        <path d="M474 160 V50 l10-14 10 14 V160 Z" />
      </g>
    </svg>
  );
}
