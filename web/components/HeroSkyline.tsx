// Hand-authored European skyline, teal-only silhouettes in three depth planes
// (20 / 45 / 100% opacity). No outlines, no texture. Purely decorative — sits
// behind the hero stat cards inside the composition panel. aria-hidden.
//
// Landmarks (front plane): a cathedral (left), the Eiffel Tower (centre) and a
// Big-Ben-style clock tower (right), with generic spires and blocks filling in.
export function HeroSkyline({ className = "" }: { className?: string }) {
  const teal = "var(--accent)";
  return (
    <svg
      viewBox="0 0 640 280"
      preserveAspectRatio="xMidYMax slice"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {/* Back plane — distant low blocks */}
      <g fill={teal} opacity="0.2">
        <rect x="0" y="196" width="46" height="84" />
        <rect x="54" y="176" width="30" height="104" />
        <rect x="150" y="188" width="40" height="92" />
        <rect x="210" y="170" width="26" height="110" />
        <rect x="360" y="184" width="44" height="96" />
        <rect x="430" y="172" width="28" height="108" />
        <rect x="470" y="190" width="52" height="90" />
        <rect x="590" y="180" width="50" height="100" />
        {/* a distant spire */}
        <path d="M120 280 L120 150 L132 128 L144 150 L144 280 Z" />
      </g>

      {/* Mid plane — mid-height buildings + spire */}
      <g fill={teal} opacity="0.45">
        <rect x="20" y="150" width="40" height="130" />
        <rect x="66" y="128" width="34" height="152" />
        <rect x="176" y="140" width="46" height="140" />
        <rect x="392" y="146" width="40" height="134" />
        <rect x="446" y="120" width="36" height="160" />
        <rect x="548" y="150" width="44" height="130" />
        {/* dome */}
        <path d="M236 280 L236 176 a26 26 0 0 1 52 0 L288 280 Z" />
        {/* thin spire */}
        <path d="M420 280 L420 96 L430 78 L440 96 L440 280 Z" />
      </g>

      {/* Front plane — the landmarks, full teal */}
      <g fill={teal}>
        {/* Cathedral (left) — twin spires + body */}
        <path d="M78 280 L78 150 L88 120 L98 150 L98 280 Z" />
        <path d="M104 280 L104 150 L114 120 L124 150 L124 280 Z" />
        <rect x="96" y="180" width="10" height="100" />

        {/* Eiffel Tower (centre) */}
        <path d="M300 60 L296 60 L296 84 L280 150 L292 150 L295 130 L305 130 L308 150 L320 150 L304 84 L304 60 Z" />
        <path d="M286 168 L314 168 L332 280 L316 280 L305 176 L295 176 L284 280 L268 280 Z" />
        <rect x="293" y="150" width="14" height="7" />
        <rect x="288" y="196" width="24" height="6" />
        <rect x="300" y="42" width="0.1" height="0.1" />
        <rect x="299.2" y="46" width="1.6" height="16" />

        {/* Big Ben (right) — clock tower with pointed spire */}
        <rect x="512" y="150" width="30" height="130" />
        <path d="M512 150 L527 116 L542 150 Z" />
        <rect x="520" y="163" width="14" height="14" />
        <rect x="524" y="96" width="6" height="22" />
        {/* neighbouring block */}
        <rect x="548" y="196" width="30" height="84" />
      </g>
    </svg>
  );
}
