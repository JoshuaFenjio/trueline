import { Flag } from "./Flag";
import { CitySilhouette } from "./CitySilhouette";
import { placePhoto } from "@/lib/cityImages";

// Full-bleed place hero (city or country). With a curated photo it applies a
// teal duotone (grayscale → multiply brand teal → screen cream lift) plus a
// bottom dark scrim so the title stays legible; without one it falls back to the
// tinted city-silhouette treatment. One component so cities and country headers
// read identically. See mockup-city.png / mockup-cities-hub.png.
export function PlaceHero({
  title, photoName, flagCountry, children,
}: {
  title: string; photoName?: string; flagCountry?: string | null; children?: React.ReactNode;
}) {
  const src = placePhoto(photoName ?? title);
  const photo = Boolean(src);
  return (
    <section className="relative mt-6 flex min-h-[240px] flex-col justify-end overflow-hidden rounded-[20px] p-8">
      {photo ? (
        <>
          <img src={src!} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover" style={{ filter: "grayscale(1) contrast(1.05)" }} />
          <div className="absolute inset-0" style={{ background: "var(--accent-deep)", mixBlendMode: "multiply", opacity: 0.78 }} />
          <div className="absolute inset-0" style={{ background: "rgba(250,250,247,0.10)", mixBlendMode: "screen" }} />
          <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(11,31,29,0.10) 35%, rgba(11,31,29,0.72) 100%)" }} />
        </>
      ) : (
        <>
          <div className="absolute inset-0" style={{ background: "var(--panel)" }} />
          <CitySilhouette className="pointer-events-none absolute inset-x-0 bottom-0 h-32 w-full" />
        </>
      )}
      <div className="relative" style={photo ? { color: "#fff" } : undefined}>
        <div className="flex items-center gap-3">
          {flagCountry && <Flag country={flagCountry} className="!h-6 !w-9 !text-xl" />}
          <h1 className="t-h1">{title}</h1>
        </div>
        {children && (
          <div className="mt-2 flex flex-wrap items-center gap-3" style={{ color: photo ? "rgba(255,255,255,0.85)" : "var(--ink-muted)" }}>
            {children}
          </div>
        )}
      </div>
    </section>
  );
}
