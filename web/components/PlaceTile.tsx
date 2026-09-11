import Link from "next/link";
import { Flag } from "./Flag";
import { CitySilhouette } from "./CitySilhouette";
import { placePhoto } from "@/lib/cityImages";
import { eur } from "@/lib/format";

// Photo-tile card for the location hubs — same teal-duotone treatment as
// PlaceHero, sized for a grid. Falls back to the tinted silhouette until a photo
// exists for the place.
export function PlaceTile({
  name, href, median, n, flagCountry, unit = "salaried",
}: {
  name: string; href: string; median: number; n: number; flagCountry?: string | null; unit?: string;
}) {
  const src = placePhoto(name);
  const photo = Boolean(src);
  return (
    <Link href={href} className="group relative flex min-h-[132px] flex-col justify-end overflow-hidden rounded-[14px] p-4">
      {photo ? (
        <>
          <img src={src!} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]" style={{ filter: "grayscale(1) contrast(1.05)" }} />
          <div className="absolute inset-0" style={{ background: "var(--accent-deep)", mixBlendMode: "multiply", opacity: 0.8 }} />
          <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(11,31,29,0.05), rgba(11,31,29,0.7))" }} />
        </>
      ) : (
        <>
          <div className="absolute inset-0 transition-[filter] group-hover:brightness-[.98]" style={{ background: "var(--panel)" }} />
          <CitySilhouette className="pointer-events-none absolute inset-x-0 bottom-0 h-16 w-full" />
        </>
      )}
      <div className="relative" style={photo ? { color: "#fff" } : undefined}>
        <div className="flex items-center gap-2">{flagCountry && <Flag country={flagCountry} />}<span className="truncate text-sm font-medium">{name}</span></div>
        <div className="tnum mt-2 text-lg font-semibold">{eur(median)}</div>
        <div className="tnum text-[11px]" style={{ color: photo ? "rgba(255,255,255,0.75)" : "var(--ink-faint)" }}>{n} {unit}</div>
      </div>
    </Link>
  );
}
