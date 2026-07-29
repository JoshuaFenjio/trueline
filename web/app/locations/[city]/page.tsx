import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCityHub, cityFromSlug } from "@/lib/data";
import { LocationView } from "@/components/LocationView";
import { eur } from "@/lib/format";

export const revalidate = 3600;
export const dynamicParams = true;

export async function generateMetadata({ params }: { params: { city: string } }): Promise<Metadata> {
  const city = await cityFromSlug(params.city);
  if (!city) return { title: "City not found" };
  const hub = await getCityHub(city);
  const med = hub.overall.spread ? eur(hub.overall.spread.median) : "live data";
  const title = `Tech salaries in ${city} 2026 — live from company job boards`;
  return {
    title,
    description: `What tech roles pay in ${city}: median ${med} base, by role, and the top local payers. Real advertised salaries from live job boards.`,
    openGraph: {
      title,
      images: [`/og?kicker=${encodeURIComponent(city + " · EMEA")}&title=${encodeURIComponent("Salaries in " + city)}&value=${encodeURIComponent(hub.overall.spread ? "Median " + med : "Live from job boards")}`],
    },
  };
}

export default async function CityPage({ params }: { params: { city: string } }) {
  const city = await cityFromSlug(params.city);
  if (!city) notFound();
  const hub = await getCityHub(city);
  return <LocationView hub={hub} />;
}
