// SalaryRadar compass mark — traced from brand-reference.png.
//
// Geometry was measured off the reference at its native size (a 130px-wide
// mark, centre 131.5/173.5) and scaled into a 64-unit box (k = 30/65):
//
//   ring        outer r 65, inner r 52  ->  mid r 27, stroke 6
//   ring gaps   44°-53° and 226°-248° (math angles, y up) — the breaks sit on
//               the needle's axis, and the lower-left one is the wider of the
//               two, exactly as in the reference
//   needle      axis 47.5°, NE tip r 41, SW tip r 43, shoulder half-width 13.4
//               (fitted to the measured half-width profile: 9 at r15, 7 at r20,
//               6 at r25, 5 at r30, 3 at r35)
//   hub         outer r 15, hole r 4.5  ->  annulus r 4.5, stroke 4.85
//
// The hole is punched with fill-rule="evenodd" rather than a white disc, so the
// mark sits correctly on any background.
//
// COLOUR: the lockup owns its green (#059C62 flat; the reference's ring runs
// light at the top to dark at the lower right, reproduced by the gradient).
// The SITE's accent stays teal — these greens are deliberately local to the
// brand components and are not design tokens.
export const BRAND_GREEN = "#059C62";
export const BRAND_GREEN_LIGHT = "#0BAB6B";
export const BRAND_GREEN_DARK = "#016C45";

const RING_D = "M48.25 10.44A27 27 0 0 0 13.24 51.42M21.89 57.03A27 27 0 0 0 51.42 13.24";
const NEEDLE_D =
  "M27.44 27.82L44.78 18.05L36.56 36.18L18.59 46.63Z" +
  "M34.08 32A2.08 2.08 0 1 0 29.92 32A2.08 2.08 0 1 0 34.08 32Z";

export function BrandMark({
  size = 26, className = "", flat = false, gradientId = "sr-brand-grad",
}: {
  size?: number;
  className?: string;
  /** Solid brand green instead of the reference's gradient — for e-mail and any
   *  renderer without gradient support. */
  flat?: boolean;
  /** Override when two differently-coloured marks share one document. */
  gradientId?: string;
}) {
  const paint = flat ? BRAND_GREEN : `url(#${gradientId})`;
  return (
    <svg
      width={size} height={size} viewBox="0 0 64 64" className={className}
      aria-hidden="true" focusable="false" role="presentation"
    >
      {!flat && (
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0.35" y2="1">
            <stop offset="0" stopColor={BRAND_GREEN_LIGHT} />
            <stop offset="0.55" stopColor={BRAND_GREEN} />
            <stop offset="1" stopColor={BRAND_GREEN_DARK} />
          </linearGradient>
        </defs>
      )}
      <path d={RING_D} fill="none" stroke={paint} strokeWidth="6" />
      <path d={NEEDLE_D} fill={paint} fillRule="evenodd" />
      <circle cx="32" cy="32" r="4.5" fill="none" stroke={paint} strokeWidth="4.85" />
    </svg>
  );
}
