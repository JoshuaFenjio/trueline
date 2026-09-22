import { Flag } from "./Flag";
import { CitySilhouette } from "./CitySilhouette";
import { placePhoto, placeCredit } from "@/lib/cityImages";

// Place hero matching mockup-city.png. Desktop: a bright full-colour photo on
// the right, faded into white toward the left where the title/meta sit (NO teal
// duotone). Mobile: the photo stacks as a banner on top and the title sits below
// on white, so text never fights the photo for contrast. Silhouette fallback
// when the place has no photo yet.
export function PlaceHero({
  title, photoName, flagCountry, children,
}: {
  title: string; photoName?: string; flagCountry?: string | null; children?: React.ReactNode;
}) {
  const src = placePhoto(photoName ?? title);
  const credit = placeCredit(photoName ?? title);
  return (
    <section className="relative mt-6 flex flex-col overflow-hidden rounded-[20px] border bg-white md:min-h-[240px] md:justify-center" style={{ borderColor: "var(--border)" }}>
      {src ? (
        <div className="relative h-40 w-full md:absolute md:inset-y-0 md:right-0 md:h-auto md:w-[64%]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" className="h-full w-full object-cover" />
          {/* mobile: fade to white at the BOTTOM (photo above the title) */}
          <div className="absolute inset-0 md:hidden" style={{ background: "linear-gradient(180deg, rgba(255,255,255,0) 55%, #fff 100%)" }} />
          {/* desktop: fade to white on the LEFT (title beside the photo) */}
          <div className="absolute inset-0 hidden md:block" style={{ background: "linear-gradient(90deg, #fff 1%, rgba(255,255,255,0.65) 24%, rgba(255,255,255,0) 58%)" }} />
          {/* Attribution on the photo itself, as Unsplash asks. Small and in
              the corner, so it credits without competing with the headline. */}
          {credit && (
            <span className="absolute bottom-1.5 right-2 text-[10px] leading-none text-white/80 mix-blend-difference">
              Photo{" "}
              <a href={credit.link} target="_blank" rel="noopener noreferrer" className="underline decoration-white/40 underline-offset-2">
                {credit.author}
              </a>{" "}
              / {credit.source}
            </span>
          )}
        </div>
      ) : (
        <>
          <div className="absolute inset-0" style={{ background: "var(--panel)" }} />
          <CitySilhouette className="pointer-events-none absolute inset-x-0 bottom-0 h-28 w-full" />
        </>
      )}
      <div className="relative max-w-xl p-8">
        <div className="flex items-center gap-3">
          {flagCountry && <Flag country={flagCountry} className="!h-6 !w-9 !text-xl" />}
          <h1 className="t-h1">{title}</h1>
        </div>
        {children && <div className="mt-3 flex flex-wrap items-center gap-3 text-ink-muted">{children}</div>}
      </div>
    </section>
  );
}
