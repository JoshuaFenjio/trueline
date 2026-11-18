import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/blocks";
import { getPublishedPages, type PageGroup } from "@/lib/publishing";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "All pages",
  description: "Every published SalaryRadar benchmark page: salaries by role, level, country, city and company, each backed by at least 8 salaried live job ads.",
  alternates: { canonical: "/sitemap" },
};

const GROUPS: [PageGroup, string][] = [
  ["static", "Overview"], ["role", "Roles"], ["role-level", "Roles by seniority"],
  ["role-country", "Roles by country"], ["role-city", "Roles by city"],
  ["country", "Countries"], ["city", "Cities"], ["company", "Companies"],
];

// HTML sitemap — the same list sitemap.xml serves (lib/publishing), as plain
// crawlable links, so every published page is at most two clicks from the footer.
export default async function SitemapPage() {
  const pages = await getPublishedPages();
  return (
    <div className="pb-16">
      <div className="pt-8"><Breadcrumbs items={[{ label: "All pages" }]} /></div>
      <h1 className="t-h2 mt-6">All pages</h1>
      <p className="mt-3 max-w-xl text-ink-muted">Every page we publish. Data pages appear here once their slice has at least 8 salaried job ads.</p>
      {GROUPS.map(([g, label]) => {
        const list = pages.filter((p) => p.group === g && p.path !== "/sitemap");
        if (!list.length) return null;
        return (
          <section key={g} className="mt-10">
            <h2 className="text-lg font-semibold">{label} <span className="tnum text-[13px] font-normal text-ink-faint">({list.length})</span></h2>
            <ul className="mt-3 columns-1 gap-6 text-[13px] sm:columns-2 lg:columns-3">
              {list.map((p) => (
                <li key={p.path} className="break-inside-avoid py-0.5"><Link href={p.path} className="text-ink-muted hover:text-ink">{p.title}</Link></li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
