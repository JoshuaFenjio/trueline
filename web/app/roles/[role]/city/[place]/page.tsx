import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRolePlaceHub, resolveRolePlace, getLastRefreshed } from "@/lib/data";
import { RolePlaceView, rolePlaceMetadata } from "@/components/RolePlaceView";

export const revalidate = 3600;
export const dynamicParams = true;

type P = { params: { role: string; place: string } };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const hit = await resolveRolePlace(params.role, "city", params.place);
  if (!hit) return { title: "Page not found" };
  return rolePlaceMetadata(await getRolePlaceHub(hit.role, "city", hit.place));
}

export default async function Page({ params }: P) {
  const hit = await resolveRolePlace(params.role, "city", params.place);
  if (!hit) notFound();
  const [hub, refreshed] = await Promise.all([getRolePlaceHub(hit.role, "city", hit.place), getLastRefreshed()]);
  return <RolePlaceView hub={hub} refreshed={refreshed} />;
}
