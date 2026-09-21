import Link from "next/link";
import { Flag } from "./Flag";
import { CitySilhouette } from "./CitySilhouette";
import { placePhoto } from "@/lib/cityImages";
import { eur } from "@/lib/format";

// Hub card matching mockup-cities-hub.png: a clean full-colour photo on top
// (NO duotone), city name + flag + median below. Falls back to the tinted
// silhouette in the image slot until a photo exists for the place.
export function PlaceTile({
  name, href, median, n, flagCountry, unit = "salaried",
}: {
  name: string; href: string; median: number; n: number; flagCountry?: string | null; unit?: string;
}) {
  const src = placePhoto(name);
  return (
    <Link href={href} className="card-hover group block overflow-hidden rounded-[14px] border bg-white" style={{ borderColor: "var(--border)" }}>
      <div className="relative aspect-[16/10] overflow-hidden" style={{ background: "var(--panel)" }}>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]" />
        ) : (
          <CitySilhouette className="absolute inset-x-0 bottom-0 h-2/3 w-full" />
        )}
      </div>
      <div className="p-4">
        <div className="flex items-center gap-2">{flagCountry && <Flag country={flagCountry} />}<span className="truncate font-semibold">{name}</span></div>
        <div className="mt-1.5 flex items-baseline justify-between gap-2">
          <span className="tnum text-lg font-semibold">{eur(median)}</span>
          <span className="tnum text-[11px] text-ink-faint">{n} {unit}</span>
        </div>
      </div>
    </Link>
  );
}
