import { slugify } from "./format";

// Places (cities OR countries) that have a hero photo at /public/cities/<slug>.webp.
// Populated by fetch_city_photos_unsplash.py (Unsplash) — it writes the slug here
// and the credit below. Until a slug is listed, the place renders the tinted
// silhouette. Gating on an explicit set avoids broken-image flashes.
const WITH_PHOTO = new Set<string>([
  "amsterdam",
  "austria",
  "barcelona",
  "belgium",
  "berlin",
  "brussels",
  "cardiff",
  "cologne",
  "copenhagen",
  "denmark",
  "dublin",
  "estonia",
  "france",
  "germany",
  "hamburg",
  "ireland",
  "italy",
  "krakow",
  "lisbon",
  "lithuania",
  "london",
  "madrid",
  "manchester",
  "milan",
  "munich",
  "netherlands",
  "paris",
  "poland",
  "porto",
  "portugal",
  "spain",
  "stockholm",
  "sweden",
  "switzerland",
  "tallinn",
  "united-kingdom",
  "vienna",
  "vilnius",
  "warsaw",
  "zurich",
]);

export function placePhoto(name: string): string | null {
  const slug = slugify(name);
  return WITH_PHOTO.has(slug) ? `/cities/${slug}.webp` : null;
}

// Attribution. Unsplash asks for photographer + Unsplash credit; kept per slug
// and rendered on /methodology. (Unsplash License permits commercial use.)
export interface PhotoCredit { author: string; source: string; link: string; }
export const PHOTO_CREDITS: Record<string, PhotoCredit> = {
  "amsterdam": { author: "Kian Lem", source: "Unsplash", link: "https://unsplash.com/photos/high-rise-building-D2AWPz1xlBw" },
  "austria": { author: "Christian Lendl", source: "Unsplash", link: "https://unsplash.com/photos/a-city-with-a-mountain-in-the-background-w2G3yEMUrsI" },
  "barcelona": { author: "Riccardo De Capitani", source: "Unsplash", link: "https://unsplash.com/photos/aerial-view-of-city-buildings-during-daytime-ZnI2XfCUtPU" },
  "belgium": { author: "Hanlin Sun", source: "Unsplash", link: "https://unsplash.com/photos/a-view-of-a-city-from-the-top-of-a-building-qVdJ35mE2GM" },
  "berlin": { author: "Florian Wehde", source: "Unsplash", link: "https://unsplash.com/photos/city-buildings-near-body-of-water-during-daytime-1uWanmgkd5g" },
  "brussels": { author: "Hanlin Sun", source: "Unsplash", link: "https://unsplash.com/photos/a-view-of-a-city-from-the-top-of-a-building-qVdJ35mE2GM" },
  "cardiff": { author: "Mike Erskine", source: "Unsplash", link: "https://unsplash.com/photos/city-with-high-rise-buildings-under-blue-sky-during-daytime-wI3IB2IhSYc" },
  "cologne": { author: "Eric Weber", source: "Unsplash", link: "https://unsplash.com/photos/gray-bridge-over-body-of-water-during-daytime--KPwl1VaSyw" },
  "copenhagen": { author: "Lindsay Martin", source: "Unsplash", link: "https://unsplash.com/photos/lake-between-city-under-blue-sky-during-daytime-qYB1OOh-iGw" },
  "denmark": { author: "Lindsay Martin", source: "Unsplash", link: "https://unsplash.com/photos/lake-between-city-under-blue-sky-during-daytime-qYB1OOh-iGw" },
  "dublin": { author: "Richard von Pfeil", source: "Unsplash", link: "https://unsplash.com/photos/a-view-of-a-city-with-a-boat-in-the-background-apir9h3fDgw" },
  "estonia": { author: "Dmitry Sumin", source: "Unsplash", link: "https://unsplash.com/photos/a-view-of-the-city-of-london-at-sunset-StgXY8EH3a0" },
  "france": { author: "Jacob Diehl", source: "Unsplash", link: "https://unsplash.com/photos/the-eiffel-tower-towering-over-the-city-of-paris-O2KDQ2KKjlU" },
  "germany": { author: "Florian Wehde", source: "Unsplash", link: "https://unsplash.com/photos/city-buildings-near-body-of-water-during-daytime-1uWanmgkd5g" },
  "hamburg": { author: "Moritz Lüdtke", source: "Unsplash", link: "https://unsplash.com/photos/a-large-body-of-water-with-a-fountain-in-the-middle-of-it-fFCwPZmAMrY" },
  "ireland": { author: "Richard von Pfeil", source: "Unsplash", link: "https://unsplash.com/photos/a-view-of-a-city-with-a-boat-in-the-background-apir9h3fDgw" },
  "italy": { author: "Onnos A.", source: "Unsplash", link: "https://unsplash.com/photos/milans-skyline-on-a-bright-sunny-day-xdseS1jekK8" },
  "krakow": { author: "Jan Ryszka", source: "Unsplash", link: "https://unsplash.com/photos/city-skyline-silhouette-against-an-orange-sunset-sky-pbJVPQYewhs" },
  "lisbon": { author: "Louis Droege", source: "Unsplash", link: "https://unsplash.com/photos/houses-near-sea-8Nd3GY8z-iU" },
  "lithuania": { author: "Piotr AMS", source: "Unsplash", link: "https://unsplash.com/photos/a-river-with-a-bridge-and-buildings-vf3rllRAyiM" },
  "london": { author: "David Monaghan", source: "Unsplash", link: "https://unsplash.com/photos/tower-bridge-london-J-wEJwSiAbQ" },
  "madrid": { author: "Emilio Garcia", source: "Unsplash", link: "https://unsplash.com/photos/a-full-moon-rising-over-a-city-with-tall-buildings-UfTH3gNcSJc" },
  "manchester": { author: "Mylo Kaye", source: "Unsplash", link: "https://unsplash.com/photos/a-view-of-a-city-from-the-top-of-a-building-NXtGjC7osPs" },
  "milan": { author: "Onnos A.", source: "Unsplash", link: "https://unsplash.com/photos/milans-skyline-on-a-bright-sunny-day-xdseS1jekK8" },
  "munich": { author: "Marlene Haiberger", source: "Unsplash", link: "https://unsplash.com/photos/a-clock-tower-in-a-city-6WXmUG6Viyk" },
  "netherlands": { author: "Kian Lem", source: "Unsplash", link: "https://unsplash.com/photos/high-rise-building-D2AWPz1xlBw" },
  "paris": { author: "Jacob Diehl", source: "Unsplash", link: "https://unsplash.com/photos/the-eiffel-tower-towering-over-the-city-of-paris-O2KDQ2KKjlU" },
  "poland": { author: "Joshua Kettle", source: "Unsplash", link: "https://unsplash.com/photos/a-body-of-water-with-a-city-in-the-background-IADgzdyI7Ls" },
  "porto": { author: "Roaming Pictures", source: "Unsplash", link: "https://unsplash.com/photos/white-and-brown-concrete-houses-7-15itL8R_o" },
  "portugal": { author: "Louis Droege", source: "Unsplash", link: "https://unsplash.com/photos/houses-near-sea-8Nd3GY8z-iU" },
  "spain": { author: "Emilio Garcia", source: "Unsplash", link: "https://unsplash.com/photos/a-full-moon-rising-over-a-city-with-tall-buildings-UfTH3gNcSJc" },
  "stockholm": { author: "Johan Anblick", source: "Unsplash", link: "https://unsplash.com/photos/city-buildings-near-body-of-water-under-blue-sky-jrMCmXISMFA" },
  "sweden": { author: "Johan Anblick", source: "Unsplash", link: "https://unsplash.com/photos/city-buildings-near-body-of-water-under-blue-sky-jrMCmXISMFA" },
  "switzerland": { author: "Thimo Pedersen", source: "Unsplash", link: "https://unsplash.com/photos/aerial-view-of-city-buildings-during-daytime-vQ9kKDptlj0" },
  "tallinn": { author: "Dmitry Sumin", source: "Unsplash", link: "https://unsplash.com/photos/a-view-of-the-city-of-london-at-sunset-StgXY8EH3a0" },
  "united-kingdom": { author: "David Monaghan", source: "Unsplash", link: "https://unsplash.com/photos/tower-bridge-london-J-wEJwSiAbQ" },
  "vienna": { author: "Christian Lendl", source: "Unsplash", link: "https://unsplash.com/photos/a-city-with-a-mountain-in-the-background-w2G3yEMUrsI" },
  "vilnius": { author: "Piotr AMS", source: "Unsplash", link: "https://unsplash.com/photos/a-river-with-a-bridge-and-buildings-vf3rllRAyiM" },
  "warsaw": { author: "Joshua Kettle", source: "Unsplash", link: "https://unsplash.com/photos/a-body-of-water-with-a-city-in-the-background-IADgzdyI7Ls" },
  "zurich": { author: "Thimo Pedersen", source: "Unsplash", link: "https://unsplash.com/photos/aerial-view-of-city-buildings-during-daytime-vQ9kKDptlj0" },
};

export function placeCredit(name: string): PhotoCredit | null {
  return PHOTO_CREDITS[slugify(name)] || null;
}

export function allPhotoCredits(): (PhotoCredit & { slug: string })[] {
  return Object.entries(PHOTO_CREDITS)
    .map(([slug, c]) => ({ slug, ...c }))
    .sort((a, b) => a.slug.localeCompare(b.slug));
}
