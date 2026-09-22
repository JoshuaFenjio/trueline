import { BrandMark, BRAND_GREEN } from "@/components/BrandMark";

// The lockup from brand-reference.png, at the reference's own proportions.
// Measured there against the mark's height H = 130px:
//
//   wordmark cap height   61  = 0.469 H
//   gap, mark -> wordmark 41  = 0.315 H
//   wordmark width       448  = 3.45  H   (set by tracking; see LETTER_SPACING)
//   tagline cap height    14  = 0.108 H
//   tagline baseline gap  47  = 0.362 H below the wordmark baseline
//
// The wordmark is live text in the site face, not outlines: it stays crisp at
// any size, is selectable, and reads to a screen reader as the site name.
const CAP_RATIO = 0.469;
// Schibsted Grotesk's cap height is ~0.72em, so font-size = cap / 0.72.
const FONT_PER_CAP = 1 / 0.72;
const GAP_RATIO = 0.315;
// Tracking is as tight as the site face reads well at. It does NOT reach the
// reference's 3.45 H width: the reference wordmark is set in a narrower face,
// and Schibsted Grotesk at 800 runs ~13% wider per unit of cap height. Fonts
// are locked, so cap height, weight, colour and the mark-to-wordmark gap match
// exactly and the width difference is a recorded, deliberate deviation rather
// than a scaleX distortion of the letterforms.
const LETTER_SPACING = "-0.035em";

export function BrandLockup({
  size = 26, tagline = false, className = "",
}: {
  /** Height of the compass mark in px; everything else scales from it. */
  size?: number;
  tagline?: boolean;
  className?: string;
}) {
  const fontSize = size * CAP_RATIO * FONT_PER_CAP;
  const gap = size * GAP_RATIO;
  const taglineSize = size * 0.108 * FONT_PER_CAP;

  return (
    <span className={`inline-flex items-center ${className}`} style={{ gap }}>
      <BrandMark size={size} />
      <span className="inline-flex flex-col" style={{ gap: size * 0.075 }}>
        <span
          style={{
            fontSize,
            fontWeight: 800,
            letterSpacing: LETTER_SPACING,
            lineHeight: 1,
            color: BRAND_GREEN,
          }}
        >
          SalaryRadar
        </span>
        {tagline && (
          <span
            style={{
              fontSize: taglineSize,
              fontWeight: 600,
              letterSpacing: "0.26em",
              lineHeight: 1,
              color: BRAND_GREEN,
            }}
          >
            SEE WHO PAYS THE MOST
          </span>
        )}
      </span>
    </span>
  );
}
