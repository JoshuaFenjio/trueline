import { flagEmoji } from "@/lib/flags";

// Consistent inline flag for country/city rows. Emoji flag in a fixed box so
// rows align whether or not we have a mapping; falls back to a neutral dot.
export function Flag({ country, className = "" }: { country: string | null | undefined; className?: string }) {
  const flag = flagEmoji(country);
  return (
    <span
      className={`inline-flex h-4 w-[22px] shrink-0 items-center justify-center overflow-hidden rounded-[3px] text-[14px] leading-none ${className}`}
      aria-hidden="true"
      style={flag ? undefined : { background: "var(--surface-3)" }}
    >
      {flag ?? ""}
    </span>
  );
}
