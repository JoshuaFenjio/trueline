import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCompanyBySlug, getAllCompanySlugs } from "@/lib/data";
import { Card, ScoreBadge, scoreColor, Stat } from "@/components/ui";
import { eur, pct } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const c = await getCompanyBySlug(params.slug);
  if (!c) return { title: "Company not found" };
  return {
    title: `${c.company} salaries`,
    description: `${c.company} pays a median advertised base of ${eur(c.medianBase)}. Pay Score ${c.payScore}/100 vs ${c.sector} peers, across ${c.salariedN} salaried roles.`,
  };
}

export default async function CompanyPage({ params }: { params: { slug: string } }) {
  const c = await getCompanyBySlug(params.slug);
  if (!c) notFound();

  const color = scoreColor(c.payScore);

  return (
    <div className="py-12">
      <Link href="/companies" className="text-sm text-ink-muted hover:text-ink">← All companies</Link>

      {/* Score hero */}
      <div className="mt-5 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-xs text-ink-faint">{c.sector}</div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight md:text-4xl">{c.company}</h1>
          <div className="mt-2 tnum text-lg text-ink-muted">
            {eur(c.medianBase)} <span className="text-ink-faint">median advertised base</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <ScoreBadge score={c.payScore} size="lg" />
          <div>
            <div className="text-sm font-medium" style={{ color }}>Pay Score {c.payScore}</div>
            <div className="max-w-[9rem] text-xs text-ink-faint">percentile vs {c.sector} peers</div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <Card className="mt-7">
        <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
          <Stat label="Salaried roles" value={<span className="tnum">{c.salariedN}</span>} />
          <Stat label="Active roles" value={<span className="tnum">{c.activeN}</span>} />
          <Stat label="Disclose pay" value={<span className="tnum">{pct(c.disclosurePct)}</span>} tone={c.disclosurePct >= 50 ? "var(--mint)" : undefined} />
          <Stat label="Median base" value={<span className="tnum">{eur(c.medianBase)}</span>} />
        </div>
      </Card>

      {/* By role vs market */}
      <h2 className="mt-9 text-lg font-medium">Median base by role <span className="text-ink-faint">vs market</span></h2>
      <Card className="mt-3 p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-ink-faint">
              <th className="px-5 py-3 font-normal">Role</th>
              <th className="px-5 py-3 font-normal text-right">{c.company}</th>
              <th className="px-5 py-3 font-normal text-right">Market</th>
              <th className="px-5 py-3 font-normal text-right">Δ</th>
            </tr>
          </thead>
          <tbody>
            {c.roles.map((r) => {
              const delta = r.companyMedian && r.marketMedian ? r.companyMedian - r.marketMedian : null;
              const dColor = delta == null ? undefined : delta >= 0 ? "var(--mint)" : "var(--ember)";
              return (
                <tr key={r.role} className="border-t">
                  <td className="px-5 py-3">{r.role} <span className="tnum text-xs text-ink-faint">· {r.companyN}</span></td>
                  <td className="px-5 py-3 text-right tnum">
                    {r.companyMedian ? eur(r.companyMedian) : <span className="text-ink-faint">n&lt;3</span>}
                  </td>
                  <td className="px-5 py-3 text-right tnum text-ink-muted">
                    {r.marketMedian ? eur(r.marketMedian) : <span className="text-ink-faint">—</span>}
                  </td>
                  <td className="px-5 py-3 text-right tnum" style={{ color: dColor }}>
                    {delta == null ? "—" : `${delta >= 0 ? "+" : "−"}${eur(Math.abs(delta)).replace("€", "€")}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      <p className="mt-3 text-xs text-ink-faint">
        Company medians shown only where 3+ salaried postings exist; market medians where 8+ exist.
      </p>

      {c.careersUrl && (
        <div className="mt-8">
          <a href={c.careersUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost inline-flex rounded-xl px-4 py-2.5 text-sm">
            View live roles at {c.company} ↗
          </a>
        </div>
      )}
    </div>
  );
}
