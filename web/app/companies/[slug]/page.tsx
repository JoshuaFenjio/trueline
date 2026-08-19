import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCompanyBySlug, getLastRefreshed } from "@/lib/data";
import { companyMeta } from "@/lib/companyMeta";
import { watchlistBySlug, WatchEntry } from "@/lib/watchlist";
import { ScoreBadge, scoreColor, Stat, Card } from "@/components/ui";
import { SectionHeader, TrendBadge, Breadcrumbs, ArrowLink } from "@/components/blocks";
import { CompanyLogo } from "@/components/CompanyLogo";
import { CompanyHiresMap } from "@/components/CompanyHiresMap";
import { eur, eurK, pct, timeAgo } from "@/lib/format";
import type { CompanyDetail } from "@/lib/data";

export const revalidate = 3600;
export const dynamicParams = true;

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const c = await getCompanyBySlug(params.slug);
  if (!c) {
    const w = watchlistBySlug(params.slug);
    if (w) return { title: `${w.name} salaries — not published`, description: `${w.name} doesn't publish salary ranges on the public job boards we read, so we have no pay data. No invented numbers.` };
    return { title: "Company not found" };
  }
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
  if (!c) {
    const w = watchlistBySlug(params.slug);
    if (w) return <WatchlistCompany w={w} />;
    notFound();
  }
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
          <CompanyLogo name={c.company} size={56} rounded="rounded-2xl" />
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
          <Stat
            label="Pay trend"
            value={c.trend.dir === "insufficient" || c.trend.dir === "new"
              ? <span className="text-sm font-normal text-ink-faint">Not enough history yet</span>
              : <TrendBadge trend={c.trend} />}
          />
        </div>
      </Card>

      {/* Compare with peers */}
      {c.peers.length > 0 && <PeerCompare c={c} />}

      {/* Sector context */}
      <SectorContext c={c} />

      {/* Salary history — only once we have >=2 months of it */}
      {c.history.length >= 2 && (
        <section className="mt-16">
          <SectionHeader kicker="History" title="Postings and median over time" />
          <Card className="mt-5"><Sparkline history={c.history} /></Card>
        </section>
      )}

      {/* Where they hire */}
      {c.markets.length > 0 && (
        <section className="mt-16">
          <SectionHeader kicker="Geography" title={`Where ${c.company} hires`} sub="Active postings by country. Median shown where 3+ are salaried; dots mark office cities." />
          <div className="mt-5"><CompanyHiresMap company={c.company} markets={c.markets} offices={c.offices} /></div>
        </section>
      )}

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
                    <td className="px-5 py-3 text-right tnum">
                      {r.companyMedian
                        ? eur(r.companyMedian)
                        : <Link href={`/add?company=${encodeURIComponent(c.company)}`} className="text-xs font-medium hover:underline" style={{ color: "var(--accent)" }}>add yours →</Link>}
                    </td>
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
        <p className="mt-3 text-xs text-ink-faint">
          Roles without a company median need 3+ salaried postings.{" "}
          <Link href={`/add?company=${encodeURIComponent(c.company)}`} className="hover:underline" style={{ color: "var(--accent)" }}>Help complete this picture — add your salary →</Link>
        </p>
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

// -- Watchlist: a famous company we track by name but have no pay data for ---
function WatchlistCompany({ w }: { w: WatchEntry }) {
  return (
    <div className="py-14">
      <Breadcrumbs items={[{ label: "Companies", href: "/companies" }, { label: w.name }]} />
      <div className="mt-5 flex items-center gap-4">
        <CompanyLogo name={w.name} domain={w.domain} size={56} rounded="rounded-2xl" />
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">{w.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 text-sm text-ink-muted">
            <span>{w.sector}</span>
            {w.hqCity && <><span className="text-ink-faint/60">·</span><span>{w.hqCity}</span></>}
          </div>
        </div>
      </div>

      <Card className="mt-6">
        <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
          <Stat label="Pay Score" value={<span className="text-ink-faint">—</span>} />
          <Stat label="Median base" value={<span className="text-ink-faint">No data</span>} />
          <Stat label="Salaried postings" value={<span className="tnum">0</span>} />
          <Stat label="Transparency" value={<span className="text-ink-faint">Unknown</span>} />
        </div>
      </Card>

      <section className="mt-10 max-w-2xl">
        <div className="tnum text-[11px] uppercase tracking-[0.22em] text-ink-faint">Why no numbers</div>
        <h2 className="mt-2 text-2xl font-extrabold tracking-tight">We don&rsquo;t have {w.name}&rsquo;s pay yet.</h2>
        <p className="mt-3 text-ink-muted">{w.reason}</p>
        <p className="mt-3 text-ink-muted">
          Rather than invent a figure, we show nothing. If {w.name} starts posting salaried roles on a public
          board we read, this page fills in automatically. Until then, the honest answer is: unknown.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href={`/add?company=${encodeURIComponent(w.name)}`} className="btn-primary rounded-lg px-4 py-2.5 text-sm font-semibold">Know their pay? Add it</Link>
          <Link href="/companies" className="btn-ghost inline-flex rounded-xl px-4 py-2.5 text-sm">Browse The Pay Index</Link>
        </div>
      </section>
    </div>
  );
}

// -- Compare with peers: this company + its 2 nearest by Pay Score -----------
function PeerCompare({ c }: { c: CompanyDetail }) {
  const rows = [
    { company: c.company, slug: c.slug, payScore: c.payScore, midpoint: c.midpoint, disclosurePct: c.disclosurePct, self: true },
    ...c.peers.map((p) => ({ ...p, self: false })),
  ];
  const compareHref = `/compare?companies=${[c.slug, ...c.peers.map((p) => p.slug)].join(",")}`;
  return (
    <section className="mt-16">
      <div className="flex items-end justify-between gap-4">
        <SectionHeader kicker="Peers" title="Compare with peers" />
        <span className="hidden md:block"><ArrowLink href={compareHref}>Full comparison</ArrowLink></span>
      </div>
      <Card className="mt-5 overflow-x-auto p-0">
        <table className="w-full min-w-[420px] text-sm">
          <thead>
            <tr className="text-left text-xs text-ink-faint">
              <th className="px-5 py-3 font-normal">Company</th>
              <th className="px-5 py-3 text-right font-normal">Pay Score</th>
              <th className="px-5 py-3 text-right font-normal">Median base</th>
              <th className="px-5 py-3 text-right font-normal">Transparency</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.slug} className="border-t" style={{ borderColor: "var(--border)", background: r.self ? "var(--accent-soft)" : undefined }}>
                <td className="px-5 py-3">
                  {r.self ? <span className="font-semibold">{r.company}</span>
                    : <Link href={`/companies/${r.slug}`} className="hover:underline">{r.company}</Link>}
                </td>
                <td className="px-5 py-3 text-right tnum font-semibold" style={{ color: scoreColor(r.payScore) }}>{r.payScore}</td>
                <td className="px-5 py-3 text-right tnum">{eur(r.midpoint)}</td>
                <td className="px-5 py-3 text-right tnum text-ink-muted">{pct(r.disclosurePct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <div className="mt-3 md:hidden"><ArrowLink href={compareHref}>Full comparison</ArrowLink></div>
    </section>
  );
}

// -- Sector context: this company's Pay Score on the sector distribution -----
function SectorContext({ c }: { c: CompanyDetail }) {
  const scores = c.sectorPeers.map((p) => p.payScore);
  const lo = Math.min(...scores, c.payScore);
  const hi = Math.max(...scores, c.payScore);
  const span = Math.max(1, hi - lo);
  const posOf = (s: number) => ((s - lo) / span) * 100;
  const col = scoreColor(c.payScore);
  return (
    <section className="mt-16">
      <SectionHeader kicker="Sector context" title={`${ordinal(c.sectorRank)} of ${c.sectorTotal} in ${c.sector}`} />
      <Card className="mt-5">
        <div className="text-sm text-ink-muted">Pay Score across {c.sectorTotal} {c.sector} {c.sectorTotal === 1 ? "company" : "companies"} we track.</div>
        <div className="relative mt-8 mb-6 h-1.5 rounded-full" style={{ background: "var(--surface-3)" }}>
          {/* peer ticks */}
          {c.sectorPeers.filter((p) => p.slug !== c.slug).map((p) => (
            <span key={p.slug} className="absolute top-1/2 h-3 w-px -translate-y-1/2" style={{ left: `${posOf(p.payScore)}%`, background: "var(--border-strong)" }} title={`${p.company}: ${p.payScore}`} />
          ))}
          {/* this company */}
          <span className="absolute -translate-x-1/2" style={{ left: `${posOf(c.payScore)}%`, top: "-6px" }}>
            <span className="block h-3.5 w-3.5 rounded-full ring-2 ring-white" style={{ background: col }} />
            <span className="tnum absolute left-1/2 top-5 -translate-x-1/2 whitespace-nowrap text-xs font-semibold" style={{ color: col }}>{c.payScore}</span>
          </span>
        </div>
        <div className="tnum flex justify-between text-[11px] text-ink-faint">
          <span>lowest {lo}</span><span>highest {hi}</span>
        </div>
      </Card>
    </section>
  );
}

// -- Salary history sparkline (median line + posting-count bars) -------------
function Sparkline({ history }: { history: CompanyDetail["history"] }) {
  const W = 640, H = 120, padX = 8, padY = 14;
  const meds = history.map((h) => h.median);
  const lo = Math.min(...meds), hi = Math.max(...meds);
  const span = Math.max(1, hi - lo);
  const x = (i: number) => padX + (i / Math.max(1, history.length - 1)) * (W - 2 * padX);
  const y = (m: number) => padY + (1 - (m - lo) / span) * (H - 2 * padY);
  const line = history.map((h, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(h.median).toFixed(1)}`).join(" ");
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: "auto" }} preserveAspectRatio="none">
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth={2} />
        {history.map((h, i) => (
          <circle key={h.month} cx={x(i)} cy={y(h.median)} r={3} fill="var(--accent)" />
        ))}
      </svg>
      <div className="tnum mt-2 flex justify-between text-[11px] text-ink-faint">
        {history.map((h) => (
          <span key={h.month} className="text-center">{h.month.slice(2)}<br /><span className="text-ink">{eurK(h.median)}</span> · {h.n}</span>
        ))}
      </div>
    </div>
  );
}
