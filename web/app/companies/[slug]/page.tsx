import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCompanyBySlug } from "@/lib/data";
import { ScoreBadge, scoreColor, Stat, Card } from "@/components/ui";
import { SectionHeader, TrendBadge } from "@/components/blocks";
import { eur, pct } from "@/lib/format";

export const revalidate = 3600;
export const dynamicParams = true;

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const c = await getCompanyBySlug(params.slug);
  if (!c) return { title: "Company not found" };
  const title = `${c.company} salaries 2026 — Pay Score ${c.payScore}/100`;
  return {
    title,
    description: `${c.company}: median advertised base ${eur(c.midpoint)}, ${ordinal(c.sectorRank)} of ${c.sectorTotal} in ${c.sector}. Pay by role vs sector, ${pct(c.disclosurePct)} of ads disclose pay.`,
    openGraph: {
      title,
      images: [`/og?kicker=${encodeURIComponent(c.sector + " · Pay Score " + c.payScore)}&title=${encodeURIComponent(c.company)}&value=${encodeURIComponent("Median " + eur(c.midpoint))}`],
    },
  };
}

export default async function CompanyPage({ params }: { params: { slug: string } }) {
  const c = await getCompanyBySlug(params.slug);
  if (!c) notFound();
  const color = scoreColor(c.payScore);

  return (
    <div className="py-14">
      <div className="tnum text-xs text-ink-faint">
        <Link href="/companies" className="hover:text-ink">Companies</Link> /{" "}
        <Link href={`/leaderboards?sector=${encodeURIComponent(c.sector)}#by-sector`} className="hover:text-ink">{c.sector}</Link>
      </div>

      {/* Score hero */}
      <div className="mt-5 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">{c.company}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-ink-muted">
            <span className="tnum text-lg text-ink">{eur(c.midpoint)}<span className="ml-1 text-sm text-ink-faint">median base</span></span>
            <span className="tnum text-sm">{ordinal(c.sectorRank)} of {c.sectorTotal} in {c.sector}</span>
            <TrendBadge trend={c.trend} />
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

      <Card className="mt-8">
        <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
          <Stat label="Salaried roles" value={<span className="tnum">{c.n}</span>} />
          <Stat label="Active roles" value={<span className="tnum">{c.activeN}</span>} />
          <Stat label="Disclose pay" value={<span className="tnum">{pct(c.disclosurePct)}</span>} tone={c.disclosurePct >= 50 ? "var(--mint)" : undefined} />
          <Stat label="Sector" value={<span className="text-lg">{c.sector}</span>} />
        </div>
      </Card>

      {/* By role vs sector */}
      <section className="mt-16">
        <SectionHeader kicker="Pay by role" title="How each role compares" accent="vs sector." />
        <Card className="mt-5 overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-faint">
                <th className="px-5 py-3 font-normal">Role</th>
                <th className="px-5 py-3 text-right font-normal">{c.company}</th>
                <th className="px-5 py-3 text-right font-normal">{c.sector} median</th>
                <th className="px-5 py-3 text-right font-normal">Δ</th>
              </tr>
            </thead>
            <tbody>
              {c.roles.map((r) => {
                const delta = r.companyMedian && r.sectorMedian ? r.companyMedian - r.sectorMedian : null;
                const dColor = delta == null ? undefined : delta >= 0 ? "var(--mint)" : "var(--ember)";
                return (
                  <tr key={r.role} className="border-t" style={{ borderColor: "var(--border)" }}>
                    <td className="px-5 py-3">
                      <Link href={`/roles/${r.slug}`} className="hover:text-ink">{r.role}</Link>
                      <span className="tnum ml-2 text-xs text-ink-faint">{r.companyN}</span>
                    </td>
                    <td className="px-5 py-3 text-right tnum">{r.companyMedian ? eur(r.companyMedian) : <span className="text-ink-faint">n&lt;3</span>}</td>
                    <td className="px-5 py-3 text-right tnum text-ink-muted">{r.sectorMedian ? eur(r.sectorMedian) : <span className="text-ink-faint">—</span>}</td>
                    <td className="px-5 py-3 text-right tnum" style={{ color: dColor }}>
                      {delta == null ? "—" : `${delta >= 0 ? "+" : "−"}${eur(Math.abs(delta))}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </section>

      {/* Similar companies */}
      {c.similar.length > 0 && (
        <section className="mt-16">
          <SectionHeader kicker="Similar" title="Companies like this" />
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {c.similar.map((s) => (
              <Link key={s.slug} href={`/companies/${s.slug}`}>
                <Card className="surface-hover h-full transition-colors">
                  <div className="font-medium">{s.company}</div>
                  <div className="mt-1 text-xs text-ink-faint">{s.sector}</div>
                  <div className="tnum mt-3 text-lg font-semibold">{eur(s.midpoint)}</div>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {c.careersUrl && (
        <div className="mt-12">
          <a href={c.careersUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost inline-flex rounded-xl px-4 py-2.5 text-sm">
            View live roles at {c.company} ↗
          </a>
        </div>
      )}
    </div>
  );
}
