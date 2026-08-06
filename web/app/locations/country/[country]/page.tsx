import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCountryHub, countryFromSlug, getCountryIndex } from "@/lib/data";
import { LocationView } from "@/components/LocationView";
import { eur, slugify } from "@/lib/format";

export const revalidate = 3600;
export const dynamicParams = true;

export async function generateMetadata({ params }: { params: { country: string } }): Promise<Metadata> {
  const country = await countryFromSlug(params.country);
  if (!country) return { title: "Country not found" };
  const hub = await getCountryHub(country);
  const med = hub.overall.spread ? eur(hub.overall.spread.median) : "live data";
  const title = `Tech salaries in ${country} 2026, live from company job boards`;
  return {
    title,
    description: `What tech roles pay across ${country}: median ${med} base, by role, and the top local payers. Real advertised salaries from live job boards.`,
    openGraph: {
      title,
      images: [`/og?kicker=${encodeURIComponent(country + " · EMEA")}&title=${encodeURIComponent("Salaries in " + country)}&value=${encodeURIComponent(hub.overall.spread ? "Median " + med : "Live from job boards")}`],
    },
  };
}

export default async function CountryPage({ params }: { params: { country: string } }) {
  const country = await countryFromSlug(params.country);
  if (!country) notFound();
  const [hub, index] = await Promise.all([getCountryHub(country), getCountryIndex()]);
  const related = index
    .filter((c) => c.name !== country)
    .slice(0, 10)
    .map((c) => ({ label: c.name, href: `/locations/country/${slugify(c.name)}` }));
  return <LocationView hub={hub} related={related} />;
}
