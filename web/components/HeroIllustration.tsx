import Image from "next/image";
import Link from "next/link";
import { eur } from "@/lib/format";
import type { HomeComposition } from "@/lib/data";

// The hero's right column: the cityscape artwork with the live stat cards
// floating over it. The artwork carries NO figures — every number here is HTML
// on top of the image, read from getHomeComposition (see hero-cityscape.webp,
// scrubbed of the stock illustration's invented cards by scrub_hero.py).
//
// Positions are percentages of the artwork box, landing roughly where those
// scrubbed cards used to sit. The wrapper carries the artwork's own aspect
// ratio, so the box never letterboxes and the percentages map onto the drawing
// exactly; it also reserves the space before the image loads (no CLS).
const ART = { src: "/hero-cityscape.webp", width: 1448, height: 1086 };

// Slot order = visual priority. Cards fill 1→3, skipping any whose data gate
// isn't met, so a missing top city promotes the role card rather than leaving
// a hole in the composition.
const SLOTS = [
  "left-[3%] top-[9%]",
  "right-[3%] top-[15%]",
  "right-[8%] bottom-[16%]",
];

export function HeroIllustration({ comp }: { comp: HomeComposition }) {
  const cards: React.ReactNode[] = [];

  // a) EMEA median base + the sample behind it. We show the sample size rather
  // than a quarter-over-quarter delta, which posted_at is too sparse to support.
  if (comp.emeaMedian > 0) {
    cards.push(
      <Card key="median" label="EMEA median base salary">
        <div className="tnum text-[19px] font-semibold leading-none">{eur(comp.emeaMedian)}</div>
        <div className="tnum mt-1 text-[10px] text-ink-faint">{comp.salaried.toLocaleString()} salaried roles</div>
      </Card>
    );
  }

  // b) Top paying city
  if (comp.topCity) {
    cards.push(
      <Card key="city" label="Top paying city" href={`/locations/${comp.topCity.slug}`}>
        <div className="text-[15px] font-semibold leading-tight">{comp.topCity.city}</div>
        <div className="tnum mt-0.5 text-[13px] font-semibold">{eur(comp.topCity.median)}</div>
        <div className="tnum mt-0.5 text-[10px] text-ink-faint">median base · n={comp.topCity.n}</div>
      </Card>
    );
  }

  // c) In-demand role + live open-role count (no volatile QoQ delta)
  if (comp.inDemandRole) {
    const r = comp.inDemandRole;
    cards.push(
      <Card key="role" label="In-demand role" href={`/roles/${r.slug}`}>
        <div className="text-[15px] font-semibold leading-tight">{r.name}</div>
        <div className="tnum mt-1 text-[10px] text-ink-faint">{r.activeN.toLocaleString()} open roles tracked</div>
      </Card>
    );
  }

  return (
    <div className="relative mx-auto aspect-[1448/1086] w-full max-h-[520px]">
      <Image
        src={ART.src}
        width={ART.width}
        height={ART.height}
        alt="Illustrated European skyline over a dotted world map"
        priority
        sizes="(min-width: 1024px) 55vw, 0px"
        className="hero-rise h-full w-full object-contain"
      />
      {cards.slice(0, 3).map((c, i) => (
        <div
          key={i}
          className={`hero-rise absolute w-[180px] ${SLOTS[i]}`}
          style={{ animationDelay: `${140 + i * 90}ms` }}
        >
          {c}
        </div>
      ))}
    </div>
  );
}

// ~180px floating card: white, hairline, lifted shadow so it reads against the
// artwork without a panel behind it.
function Card({ label, href, children }: { label: string; href?: string; children: React.ReactNode }) {
  const body = (
    <>
      <div className="text-[11px] leading-tight text-ink-faint">{label}</div>
      <div className="mt-2">{children}</div>
    </>
  );
  return href ? (
    <Link href={href} className="card-float card-hover block p-3.5">{body}</Link>
  ) : (
    <div className="card-float p-3.5">{body}</div>
  );
}
