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
  "amsterdam": { author: "Serhii Hyliuk", source: "Unsplash", link: "https://unsplash.com/photos/a-boat-traveling-down-a-river-next-to-tall-buildings-3ZN36lJaFew" },
  "austria": { author: "Christian Lendl", source: "Unsplash", link: "https://unsplash.com/photos/a-city-with-a-mountain-in-the-background-w2G3yEMUrsI" },
  "barcelona": { author: "Jorge Salvador", source: "Unsplash", link: "https://unsplash.com/photos/aerial-photography-of-city-during-daytime-Vz0ZNqVI90k" },
  "belgium": { author: "Hanlin Sun", source: "Unsplash", link: "https://unsplash.com/photos/a-view-of-a-city-from-the-top-of-a-building-qVdJ35mE2GM" },
  "berlin": { author: "Florian Wehde", source: "Unsplash", link: "https://unsplash.com/photos/city-buildings-near-body-of-water-during-daytime-1uWanmgkd5g" },
  "brussels": { author: "Hanlin Sun", source: "Unsplash", link: "https://unsplash.com/photos/a-view-of-a-city-from-the-top-of-a-building-qVdJ35mE2GM" },
  "cologne": { author: "Eric Weber", source: "Unsplash", link: "https://unsplash.com/photos/gray-bridge-over-body-of-water-during-daytime--KPwl1VaSyw" },
  "copenhagen": { author: "Lindsay Martin", source: "Unsplash", link: "https://unsplash.com/photos/lake-between-city-under-blue-sky-during-daytime-qYB1OOh-iGw" },
  "denmark": { author: "Lindsay Martin", source: "Unsplash", link: "https://unsplash.com/photos/lake-between-city-under-blue-sky-during-daytime-qYB1OOh-iGw" },
  "dublin": { author: "Richard von Pfeil", source: "Unsplash", link: "https://unsplash.com/photos/a-view-of-a-city-with-a-boat-in-the-background-apir9h3fDgw" },
  "estonia": { author: "Rasmus Andersen", source: "Unsplash", link: "https://unsplash.com/photos/an-aerial-view-of-a-city-with-a-church-tower-L-uRLn4MOG0" },
  "france": { author: "Jacob Diehl", source: "Unsplash", link: "https://unsplash.com/photos/the-eiffel-tower-towering-over-the-city-of-paris-O2KDQ2KKjlU" },
  "germany": { author: "Florian Wehde", source: "Unsplash", link: "https://unsplash.com/photos/city-buildings-near-body-of-water-during-daytime-1uWanmgkd5g" },
  "hamburg": { author: "Mevoya", source: "Unsplash", link: "https://unsplash.com/photos/a-group-of-people-walking-across-a-bridge-over-a-river-OPK0-OLsdQA" },
  "ireland": { author: "Richard von Pfeil", source: "Unsplash", link: "https://unsplash.com/photos/a-view-of-a-city-with-a-boat-in-the-background-apir9h3fDgw" },
  "italy": { author: "Nicola Pavan", source: "Unsplash", link: "https://unsplash.com/photos/aerial-view-of-city-buildings-during-daytime-TWqEt_jwW2s" },
  "krakow": { author: "Martti Salmi", source: "Unsplash", link: "https://unsplash.com/photos/a-large-building-with-a-clock-tower-on-top-of-it-j1dudw2u71k" },
  "lisbon": { author: "Remy Gieling", source: "Unsplash", link: "https://unsplash.com/photos/a-view-of-a-city-with-a-bridge-in-the-background-Yndj0psIO_0" },
  "lithuania": { author: "Piotr AMS", source: "Unsplash", link: "https://unsplash.com/photos/a-river-with-a-bridge-and-buildings-vf3rllRAyiM" },
  "london": { author: "David Monaghan", source: "Unsplash", link: "https://unsplash.com/photos/tower-bridge-london-J-wEJwSiAbQ" },
  "madrid": { author: "Chris Curry", source: "Unsplash", link: "https://unsplash.com/photos/white-concrete-building-under-blue-sky-during-daytime-Q2r0SSOQdgQ" },
  "manchester": { author: "Mylo Kaye", source: "Unsplash", link: "https://unsplash.com/photos/a-view-of-a-city-from-the-top-of-a-building-NXtGjC7osPs" },
  "milan": { author: "Rich Martello", source: "Unsplash", link: "https://unsplash.com/photos/city-skyline-with-modern-skyscrapers-and-historic-buildings-NyxHoiDqzd0" },
  "munich": { author: "Marlene Haiberger", source: "Unsplash", link: "https://unsplash.com/photos/a-clock-tower-in-a-city-6WXmUG6Viyk" },
  "netherlands": { author: "Adrien Olichon", source: "Unsplash", link: "https://unsplash.com/photos/boats-on-canal-in-amsterdam-QRtym77B6xk" },
  "paris": { author: "Jacob Diehl", source: "Unsplash", link: "https://unsplash.com/photos/the-eiffel-tower-towering-over-the-city-of-paris-O2KDQ2KKjlU" },
  "poland": { author: "Jakub Żerdzicki", source: "Unsplash", link: "https://unsplash.com/photos/a-city-with-tall-buildings-and-a-crane-in-the-foreground-ckmnkSZTFVo" },
  "porto": { author: "Roaming Pictures", source: "Unsplash", link: "https://unsplash.com/photos/white-and-brown-concrete-houses-7-15itL8R_o" },
  "portugal": { author: "Remy Gieling", source: "Unsplash", link: "https://unsplash.com/photos/a-view-of-a-city-with-a-bridge-in-the-background-Yndj0psIO_0" },
  "spain": { author: "Chris Curry", source: "Unsplash", link: "https://unsplash.com/photos/white-concrete-building-under-blue-sky-during-daytime-Q2r0SSOQdgQ" },
  "stockholm": { author: "Johan Anblick", source: "Unsplash", link: "https://unsplash.com/photos/city-buildings-near-body-of-water-under-blue-sky-jrMCmXISMFA" },
  "sweden": { author: "Johan Anblick", source: "Unsplash", link: "https://unsplash.com/photos/city-buildings-near-body-of-water-under-blue-sky-jrMCmXISMFA" },
  "switzerland": { author: "Thimo Pedersen", source: "Unsplash", link: "https://unsplash.com/photos/aerial-view-of-city-buildings-during-daytime-vQ9kKDptlj0" },
  "tallinn": { author: "Andres Garcia", source: "Unsplash", link: "https://unsplash.com/photos/brown-and-white-concrete-houses-under-gray-sky-gCTXpJCP3yI" },
  "united-kingdom": { author: "David Monaghan", source: "Unsplash", link: "https://unsplash.com/photos/tower-bridge-london-J-wEJwSiAbQ" },
  "vienna": { author: "Christian Lendl", source: "Unsplash", link: "https://unsplash.com/photos/a-city-with-a-mountain-in-the-background-w2G3yEMUrsI" },
  "vilnius": { author: "Piotr AMS", source: "Unsplash", link: "https://unsplash.com/photos/a-river-with-a-bridge-and-buildings-vf3rllRAyiM" },
  "warsaw": { author: "Jakub Żerdzicki", source: "Unsplash", link: "https://unsplash.com/photos/a-city-with-tall-buildings-and-a-crane-in-the-foreground-ckmnkSZTFVo" },
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
