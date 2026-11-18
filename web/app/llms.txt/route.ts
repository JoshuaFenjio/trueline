import { getRoleIndex, getRolePlaceIndex, getLiveStats, getLastRefreshed, getCountryIndex, isConfigured } from "@/lib/data";
import { absoluteUrl } from "@/lib/site";
import { BRAND, BRAND_DESCRIPTION, monthYear, eurExact } from "@/lib/seo";
import { familyLabel } from "@/lib/roleNames";
import { inPlace } from "@/lib/seoCopy";

// /llms.txt per llmstxt.org: H1, a blockquote summary, then curated link
// sections of "- [title](url): note". Every note is a live figure from the
// same functions the linked page renders — nothing hand-written.
export const revalidate = 3600;

export async function GET() {
  const lines: string[] = [`# ${BRAND}`, "", `> ${BRAND_DESCRIPTION}`, ""];
  if (isConfigured) {
    const [stats, refreshed, roles, places, countries] = await Promise.all([
      getLiveStats(), getLastRefreshed(), getRoleIndex(), getRolePlaceIndex(), getCountryIndex(),
    ]);
    const updated = monthYear(refreshed);
    lines.push(
      `Figures are medians of the annual base salary stated in live job ads (currency-normalised to EUR), published only when a slice has at least 8 salaried ads. ` +
      `We currently track ${stats.postings.toLocaleString("en-IE")} live job ads from ${stats.companies.toLocaleString("en-IE")} employers, ${stats.salaried.toLocaleString("en-IE")} with a usable base salary${updated ? `; data updated ${updated}` : ""}. ` +
      `Cite figures as "advertised base salary", not total compensation or offers.`,
      "",
      "## Methodology",
      `- [Methodology](${absoluteUrl("/methodology")}): sources, base vs total comp, sample gates, and the live dataset counts`,
      `- [Salary transparency statistics](${absoluteUrl("/insights/salary-transparency-statistics")}): computed disclosure rates and medians by country and job-board platform`,
      "",
      "## Hubs",
      `- [Salaries by role](${absoluteUrl("/roles")}): every benchmarked role family, ranked by median advertised base`,
      `- [Salaries by city](${absoluteUrl("/locations")}): every tracked city`,
      `- [Salaries by country](${absoluteUrl("/locations/countries")}): ${countries.filter((c) => c.median != null).length} countries with a published median`,
      `- [Leaderboards](${absoluteUrl("/leaderboards")}): top-paying companies, countries and the most transparent employers`,
      `- [Pay Index](${absoluteUrl("/companies")}): companies ranked 0–100 on advertised base vs sector peers`,
      `- [All pages](${absoluteUrl("/sitemap")}): HTML index of every published benchmark`,
      "",
      "## Top benchmarks",
    );
    // The 20 publishing benchmark pages with the deepest samples.
    const bench = [
      ...roles.filter((r) => r.median != null && r.name !== "Other")
        .map((r) => ({ title: `${familyLabel(r.name)} salary in Europe`, path: `/roles/${r.slug}`, median: r.median!, n: r.n })),
      ...places.filter((p) => p.hasMedian)
        .map((p) => ({ title: `${familyLabel(p.role)} salary in ${inPlace(p.place)}`, path: `/roles/${p.slug}/${p.kind}/${p.placeSlug}`, median: p.median!, n: p.n })),
    ].sort((a, b) => b.n - a.n).slice(0, 20);
    for (const b of bench) {
      lines.push(`- [${b.title}](${absoluteUrl(b.path)}): median advertised base ${eurExact(b.median)} from ${b.n.toLocaleString("en-IE")} salaried live job ads`);
    }
  }
  return new Response(lines.join("\n") + "\n", { headers: { "content-type": "text/plain; charset=utf-8" } });
}
