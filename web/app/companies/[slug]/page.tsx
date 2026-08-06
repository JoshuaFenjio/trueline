import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCompanyBySlug, getLastRefreshed } from "@/lib/data";
import { companyMeta } from "@/lib/companyMeta";
import { ScoreBadge, scoreColor, Stat, Card } from "@/components/ui";
import { SectionHeader, TrendBadge, Breadcrumbs } from "@/components/blocks";
import { eur, eurK, pct, timeAgo } from "@/lib/format";

export const revalidate = 3600;
export const dynamicParams = true;

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const c = await getCompanyBySlug(params.slug);
  if (!c) return { title: "Company not found" };
  const title = `${c.company} salaries 2026 · Pay Score ${c.payScore}/100`;
  return {
    title,
    description: `${c.company}: median advertised base ${eur(c.midpoint)}, ${ordinal(c.sectorRank)} of ${c.sectorTotal} in ${c.sector}, ${pct(c.disclosurePct)} of ads disclose pay.`,
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
  const refreshed = await getLastRefreshed();
  const meta = companyMeta(c.company);

  const metaBits = [
    c.sector,
    meta.hqCity,
    meta.founded ? `Founded ${meta.founded}` : null,
    meta.stage,
  ].filter(Boolean) as string[];

  // "What we don't know yet" — honest gaps.
  const thinRoles = c.roles.filter((r) => r.companyMedian === null).map((r) => r.role);
  const gaps: string[] = [];
  if (c.disclosurePct < 40) gaps.push(`Most ${c.company} ads don't state pay; only ${pct(c.disclosurePct)} do, so this is a partial picture.`);
  if (thinRoles.length) gaps.push(`Not enough salaried postings yet to publish a median for: ${thinRoles.slice(0, 6).join(", ")}.`);
  if (c.latest.length === 0) gaps.push("No advertised salary ranges we could verify right now.");

  return (
    <div className="py-14">
      <Breadcrumbs items={[
        { label: "Companies", href: "/companies" },
        { label: c.sector, href: `/leaderboards?sector=${encodeURIComponent(c.sector)}#by-sector` },
        { label: c.company },
      ]} />

      {/* Hero */}
      <div className="mt-5 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <span
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl font-semibold"
            style={{ background: "var(--surface-3)", color: "var(--ink)", border: "1px solid var(--border)" }}
          >
            {c.company.charAt(0)}
          </span>
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">{c.company}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
              {metaBits.map((b, i) => (
                <span key={i} className="flex items-center gap-3">
                  {i > 0 && <span className="text-ink-faint/60">·</span>}{b}
                </span>
              ))}
              {meta.website && (
                <>
                  <span className="text-ink-faint/60">·</span>
                  <a href={`https://${meta.website}`} target="_blank" rel="noopener noreferrer" className="text-brand-2 hover:underline">{meta.website} ↗</a>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <ScoreBadge score={c.payScore} size="lg" />
          <div>
            <div className="text-sm font-medium" style={{ color }}>Pay Score {c.payScore}</div>
            <div className="max-w-[9rem] text-xs text-ink-faint">{ordinal(c.sectorRank)} of {c.sectorTotal} in {c.sector}</div>
          </div>
        </div>
      </div>

      <div className="tnum mt-4 text-[11px] text-ink-faint">
        {c.activeN} active postings · data refreshed {timeAgo(refreshed)}
      </div>

      <Card className="mt-6">
        <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
          <Stat label="Median base" value={<span className="tnum">{eur(c.midpoint)}</span>} />
          <Stat label="Transparency" value={<span className="tnum">{pct(c.disclosurePct)}</span>} tone={c.disclosurePct >= 50 ? "var(--mint)" : c.disclosurePct < 25 ? "var(--ember)" : undefined} />
          <Stat label="Salaried roles" value={<span className="tnum">{c.n}</span>} />
          <Stat label="Pay trend" value={<TrendBadge trend={c.trend} />} />
        </div>
      </Card>

      {/* Latest salaried postings */}
      {c.latest.length > 0 && (
        <section className="mt-16">
          <SectionHeader kicker="Live" title="Latest salaried postings" />
          <Card className="mt-5 overflow-hidden p-0">
            <ul>
              {c.latest.map((p, i) => {
                const inner = (
                  <div className="flex items-center justify-between gap-4 px-5 py-3.5">
                    <div className="min-w-0">
                      <div className="truncate">{p.title}</div>
                      <div className="tnum mt-0.5 text-xs text-ink-faint">{p.city}{p.postedAt ? ` · posted ${timeAgo(p.postedAt)}` : ""}</div>
                    </div>
                    <div className="tnum shrink-0 text-right text-ink">{p.lo === p.hi ? eurK(p.lo) : `${eurK(p.lo)}–${eurK(p.hi)}`}</div>
                  </div>
                );
                return (
                  <li key={i} className={i > 0 ? "border-t" : ""} style={{ borderColor: "var(--border)" }}>
                    {p.url ? <a href={p.url} target="_blank" rel="noopener noreferrer" className="block transition-colors hover:bg-[var(--surface-2)]">{inner}</a> : inner}
                  </li>
                );
              })}
            </ul>
          </Card>
        </section>
      )}

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

      {/* What we don't know yet */}
      {gaps.length > 0 && (
        <section className="mt-16">
          <SectionHeader kicker="Honest limits" title="What we don't know yet" />
          <Card className="mt-5">
            <ul className="space-y-2 text-sm text-ink-muted">
              {gaps.map((g, i) => (
                <li key={i} className="flex gap-2"><span className="text-ink-faint">—</span><span>{g}</span></li>
              ))}
            </ul>
          </Card>
        </section>
      )}

      {/* Similar + careers */}
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

      <div className="mt-12 flex flex-wrap gap-3">
        {c.careersUrl && (
          <a href={c.careersUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost inline-flex rounded-xl px-4 py-2.5 text-sm">
            View live roles at {c.company} ↗
          </a>
        )}
        <Link href="/compare" className="btn-ghost inline-flex rounded-xl px-4 py-2.5 text-sm">Compare with others</Link>
      </div>
    </div>
  );
}
