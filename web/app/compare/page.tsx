import Link from "next/link";
import type { Metadata } from "next";
import { getCompanyBySlug, getCompaniesBoard, isConfigured } from "@/lib/data";
import type { CompanyDetail } from "@/lib/data";
import { CompareBuilder } from "@/components/CompareBuilder";
import { ShareButton } from "@/components/ShareButton";
import { CompanyHiresMap } from "@/components/CompanyHiresMap";
import { CompanyLogo } from "@/components/CompanyLogo";
import { Sparkline } from "@/components/Sparkline";
import { Breadcrumbs } from "@/components/blocks";
import { Icon } from "@/components/icons";
import { scoreColor } from "@/components/ui";
import { eur, pct } from "@/lib/format";

export const dynamic = "force-dynamic";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://trueline-azure.vercel.app";

function parseSlugs(sp: { companies?: string }): string[] {
  return (sp.companies || "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 3);
}

export async function generateMetadata({ searchParams }: { searchParams: { companies?: string } }): Promise<Metadata> {
  const slugs = parseSlugs(searchParams);
  if (slugs.length < 2) return { title: "Compare companies", description: "Compare tech companies side by side on pay, transparency and role-by-role medians." };
  const cos = (await Promise.all(slugs.map((s) => getCompanyBySlug(s)))).filter(Boolean) as CompanyDetail[];
  const names = cos.map((c) => c.company);
  const title = `${names.join(" vs ")}: who pays more?`;
  const og = `/og?kicker=${encodeURIComponent("Compare · EMEA")}&title=${encodeURIComponent(names.join(" vs "))}&value=${encodeURIComponent("Pay, transparency and role medians")}`;
  return { title, description: `${names.join(", ")} compared on Pay Score, median base, transparency and role-by-role pay.`, openGraph: { title: `${title} · Trueline`, images: [og] }, twitter: { card: "summary_large_image", images: [og] } };
}

function recencyDays(c: CompanyDetail): number | null {
  const ts = c.latest.map((p) => (p.postedAt ? Date.parse(p.postedAt) : NaN)).filter((n) => !Number.isNaN(n));
  if (!ts.length) return null;
  return Math.round((Date.now() - Math.max(...ts)) / 86400000);
}
function tier(n: number, hi: number, mid: number) { return n >= hi ? "High" : n >= mid ? "Medium" : "Low"; }
function tierColor(t: string) { return t === "High" ? "var(--mint)" : t === "Medium" ? "var(--accent)" : "var(--ink-faint)"; }

export default async function ComparePage({ searchParams }: { searchParams: { companies?: string } }) {
  if (!isConfigured) return <p className="py-24 text-center text-ink-muted">Supabase not configured.</p>;
  const slugs = parseSlugs(searchParams);
  const [cosRaw, board] = await Promise.all([Promise.all(slugs.map((s) => getCompanyBySlug(s))), getCompaniesBoard()]);
  const cos = cosRaw.filter(Boolean) as CompanyDetail[];
  const all = board.map((c) => ({ name: c.company, slug: c.slug }));

  const sectorMid = new Map<string, number[]>();
  for (const c of board) { const a = sectorMid.get(c.sector) || []; a.push(c.midpoint); sectorMid.set(c.sector, a); }
  const sectorAvg = (s: string) => { const v = sectorMid.get(s) || []; return v.length ? v.reduce((x, y) => x + y, 0) / v.length : 0; };

  const roleCount = new Map<string, number>();
  for (const c of cos) for (const r of c.roles) if (r.companyMedian != null) roleCount.set(r.role, (roleCount.get(r.role) || 0) + 1);
  const roles = [...roleCount.entries()].filter(([, n]) => n >= 2).map(([r]) => r).slice(0, 10);
  const roleMed = (c: CompanyDetail, role: string) => c.roles.find((r) => r.role === role)?.companyMedian ?? null;

  const shareUrl = `${SITE}/compare?companies=${cos.map((c) => c.slug).join(",")}`;
  const shareText = encodeURIComponent(`${cos.map((c) => c.company).join(" vs ")}: who pays more?`);

  return (
    <div className="pb-4">
      <div className="pt-8"><Breadcrumbs items={[{ label: "Companies", href: "/companies" }, { label: "Compare" }]} /></div>

      <header className="mt-6">
        <span className="eyebrow-pill"><span className="eyebrow">Company comparison</span></span>
        <h1 className="t-h1 mt-5">Compare. Decide. <span className="font-normal italic">Confidently.</span></h1>
        <p className="mt-4 max-w-xl text-lg leading-relaxed text-ink-muted">Line up to three companies side by side on median base, transparency and role-by-role pay — live from job boards.</p>
      </header>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_300px]">
        <div>
          {cos.length < 2 ? (
            <div className="card">
              <p className="text-sm text-ink-muted">Add two or three companies from the panel. Popular comparisons:</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {[["monzo", "wise", "gocardless"], ["gitlab", "grafana-labs"], ["deliveroo", "wolt"]].map((set) => {
                  const names = set.map((s) => board.find((b) => b.slug === s)?.company).filter(Boolean);
                  if (names.length < 2) return null;
                  return <Link key={set.join()} href={`/compare?companies=${set.join(",")}`} className="pill-btn">{names.join(" vs ")}</Link>;
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-10">
              <section>
                <div className="mb-4 flex items-center gap-2.5"><span className="icon-chip"><Icon.bars size={15} /></span><span className="text-[15px] font-semibold">Median base overview</span></div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {cos.map((c) => {
                    const vs = c.midpoint - sectorAvg(c.sector);
                    return (
                      <div key={c.slug} className="card">
                        <Link href={`/companies/${c.slug}`} className="flex items-center gap-2.5 hover:text-[var(--accent)]"><CompanyLogo name={c.company} size={28} /><span className="font-medium">{c.company}</span></Link>
                        <div className="tnum mt-3 text-2xl font-semibold">{eur(c.midpoint)}</div>
                        <div className="tnum mt-1 text-[12px]" style={{ color: vs >= 0 ? "var(--mint)" : "var(--ember)" }}>{vs >= 0 ? "+" : "−"}{eur(Math.abs(Math.round(vs)))} vs {c.sector} avg</div>
                        {c.history.length >= 2 && <div className="mt-3"><Sparkline values={c.history.map((h) => h.median)} width={220} height={34} className="w-full" /></div>}
                      </div>
                    );
                  })}
                </div>
              </section>

              <section>
                <div className="mb-4 flex items-center gap-2.5"><span className="icon-chip"><Icon.shield size={15} /></span><span className="text-[15px] font-semibold">Transparency &amp; data quality</span></div>
                <div className="card overflow-x-auto !p-0">
                  <table className="w-full min-w-[420px] text-sm">
                    <thead><tr className="border-b" style={{ borderColor: "var(--border)" }}><th className="px-5 py-3 text-left text-[12px] font-normal text-ink-faint">Metric</th>{cos.map((c) => <th key={c.slug} className="px-5 py-3 text-right font-medium">{c.company}</th>)}</tr></thead>
                    <tbody>
                      <tr className="border-t" style={{ borderColor: "var(--border)" }}><td className="px-5 py-3 text-ink-muted">Pay Score</td>{cos.map((c) => <td key={c.slug} className="px-5 py-3 text-right tnum font-semibold" style={{ color: scoreColor(c.payScore) }}>{c.payScore}</td>)}</tr>
                      <tr className="border-t" style={{ borderColor: "var(--border)" }}><td className="px-5 py-3 text-ink-muted">Tracked postings</td>{cos.map((c) => <td key={c.slug} className="px-5 py-3 text-right tnum">{c.activeN}</td>)}</tr>
                      <tr className="border-t" style={{ borderColor: "var(--border)" }}><td className="px-5 py-3 text-ink-muted">Disclosed pay</td>{cos.map((c) => <td key={c.slug} className="px-5 py-3 text-right tnum" style={{ color: c.disclosurePct >= 50 ? "var(--mint)" : c.disclosurePct < 25 ? "var(--ember)" : undefined }}>{pct(c.disclosurePct)}</td>)}</tr>
                      <tr className="border-t" style={{ borderColor: "var(--border)" }}><td className="px-5 py-3 text-ink-muted">Data recency</td>{cos.map((c) => { const d = recencyDays(c); return <td key={c.slug} className="px-5 py-3 text-right tnum text-ink-muted">{d == null ? "—" : `${d}d ago`}</td>; })}</tr>
                      <tr className="border-t" style={{ borderColor: "var(--border)" }}><td className="px-5 py-3 text-ink-muted">Geo coverage</td>{cos.map((c) => { const t = tier(c.markets.length, 5, 2); return <td key={c.slug} className="px-5 py-3 text-right"><span className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ color: tierColor(t), background: `${tierColor(t)}1a` }}>{t}</span></td>; })}</tr>
                    </tbody>
                  </table>
                </div>
              </section>

              {roles.length > 0 && (
                <section>
                  <div className="mb-4 flex items-center gap-2.5"><span className="icon-chip"><Icon.briefcase size={15} /></span><span className="text-[15px] font-semibold">Median by role</span></div>
                  <div className="card overflow-x-auto !p-0">
                    <table className="w-full min-w-[420px] text-sm">
                      <thead><tr className="border-b" style={{ borderColor: "var(--border)" }}><th className="px-5 py-3 text-left text-[12px] font-normal text-ink-faint">Role</th>{cos.map((c) => <th key={c.slug} className="px-5 py-3 text-right font-medium">{c.company}</th>)}</tr></thead>
                      <tbody>
                        {roles.map((role) => {
                          const vals = cos.map((c) => roleMed(c, role));
                          const best = Math.max(...vals.filter((v): v is number => v != null));
                          return (
                            <tr key={role} className="border-t" style={{ borderColor: "var(--border)" }}>
                              <td className="px-5 py-3 text-ink-muted">{role}</td>
                              {cos.map((c) => { const v = roleMed(c, role); return <td key={c.slug} className="px-5 py-3 text-right tnum" style={{ color: v && v === best ? "var(--mint)" : v ? undefined : "var(--ink-faint)" }}>{v ? eur(v) : "—"}</td>; })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              <section>
                <div className="mb-4 flex items-center gap-2.5"><span className="icon-chip"><Icon.globe size={15} /></span><span className="text-[15px] font-semibold">Hiring footprint</span></div>
                <div className="grid gap-4 md:grid-cols-3">
                  {cos.map((c) => (
                    <div key={c.slug} className="card !p-3">
                      <div className="px-1 pb-2 text-[13px] font-medium">{c.company}</div>
                      {c.markets.length ? <CompanyHiresMap company={c.company} markets={c.markets} offices={c.offices} /> : <p className="px-1 pb-2 text-sm text-ink-faint">No location data.</p>}
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}
        </div>

        <aside className="space-y-6 lg:sticky lg:top-20 lg:self-start">
          <div className="card">
            <div className="flex items-center gap-2.5"><span className="icon-chip"><Icon.scale size={15} /></span><span className="text-[15px] font-semibold">Companies</span></div>
            <div className="mt-4"><CompareBuilder all={all} selected={cos.map((c) => c.slug)} /></div>
          </div>
          {cos.length >= 2 && (
            <div className="card">
              <div className="flex items-center gap-2.5"><span className="icon-chip"><Icon.arrow size={15} /></span><span className="text-[15px] font-semibold">Share this comparison</span></div>
              <div className="mt-3 rounded-xl p-3" style={{ background: "var(--band)" }}>
                <div className="text-[13px] font-medium">{cos.map((c) => c.company).join(" vs ")}</div>
                <div className="tnum mt-1 text-[12px] text-ink-faint">{cos.map((c) => eur(c.midpoint)).join(" · ")}</div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <ShareButton path={`/compare?companies=${cos.map((c) => c.slug).join(",")}`} />
                <a href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${shareText}`} target="_blank" rel="noopener noreferrer" aria-label="Share on X" className="flex h-8 w-8 items-center justify-center rounded-lg border text-ink-muted transition-colors hover:text-ink" style={{ borderColor: "var(--border)" }}><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.9 2H22l-7.1 8.1L23 22h-6.5l-5-6.6L5.7 22H2.5l7.6-8.7L2 2h6.7l4.5 6 5.7-6Z" /></svg></a>
                <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noopener noreferrer" aria-label="Share on LinkedIn" className="flex h-8 w-8 items-center justify-center rounded-lg border text-ink-muted transition-colors hover:text-ink" style={{ borderColor: "var(--border)" }}><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4.98 3.5A2.5 2.5 0 1 0 5 8.5a2.5 2.5 0 0 0 0-5ZM3 9h4v12H3zM9 9h3.8v1.7h.05c.53-1 1.83-2.05 3.76-2.05C20.3 8.65 21 11 21 14.1V21h-4v-6c0-1.43-.03-3.27-2-3.27-2 0-2.3 1.56-2.3 3.17V21H9z" /></svg></a>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
