import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCompanyBySlug, getLastRefreshed, getCommunityActivity } from "@/lib/data";
import { companyMeta } from "@/lib/companyMeta";
import { watchlistBySlug, WatchEntry } from "@/lib/watchlist";
import { ScoreBadge, scoreColor, Card, Stat } from "@/components/ui";
import { SectionHeader, Breadcrumbs, ArrowLink, PillButton } from "@/components/blocks";
import { CompanyLogo } from "@/components/CompanyLogo";
import { PostingList } from "@/components/PostingList";
import { CommunityActivity } from "@/components/CommunityActivity";
import { CompanyHiresMap } from "@/components/CompanyHiresMap";
import { GpgModule } from "@/components/GpgModule";
import { ShareButton } from "@/components/ShareButton";
import { Icon } from "@/components/icons";
import { eur, eurK, pct, timeAgo, slugify } from "@/lib/format";
import { familyLabel } from "@/lib/roleNames";
import type { CompanyDetail } from "@/lib/data";

const COMPANY_TABS = [
  { id: "overview", label: "Overview", icon: Icon.target },
  { id: "locations", label: "Locations", icon: Icon.globe },
  { id: "salaries", label: "Salaries", icon: Icon.bars },
  { id: "roles", label: "Roles", icon: Icon.briefcase },
  { id: "jobs", label: "Jobs", icon: Icon.building },
];
function tier(n: number, hi: number, mid: number) { return n >= hi ? "High" : n >= mid ? "Medium" : "Low"; }
function tierColor(t: string) { return t === "High" ? "var(--mint)" : t === "Medium" ? "var(--accent)" : "var(--ink-faint)"; }

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
  const [refreshed, community] = await Promise.all([getLastRefreshed(), getCommunityActivity(c.company)]);
  const meta = companyMeta(c.company);
  const chips = [c.sector, meta.hqCity, meta.stage, meta.founded ? `Founded ${meta.founded}` : null, meta.employees ? `${meta.employees} employees` : null].filter(Boolean) as string[];
  const topPct = c.sectorTotal ? Math.max(1, Math.round((c.sectorRank / c.sectorTotal) * 100)) : null;

  // Transparency sub-scores — all from real fields.
  const recentDays = c.latest.reduce((min, p) => {
    if (!p.dateMs) return min;
    return Math.min(min, (Date.now() - p.dateMs) / 86400000);
  }, Infinity);
  const subScores = [
    { label: "Data volume", tier: tier(c.activeN, 30, 10), note: `${c.activeN} live job ads` },
    { label: "Role coverage", tier: tier(c.roles.length, 8, 4), note: `${c.roles.length} role families` },
    { label: "Geo coverage", tier: tier(c.markets.length, 5, 2), note: `${c.markets.length} countries` },
    { label: "Recency", tier: recentDays <= 21 ? "High" : recentDays <= 60 ? "Medium" : "Low", note: recentDays === Infinity ? "no dated ads" : `newest ${Math.round(recentDays)}d ago` },
  ];

  const thinRoles = c.roles.filter((r) => r.companyMedian === null).map((r) => familyLabel(r.role));
  const gaps: string[] = [];
  if (c.disclosurePct < 40) gaps.push(`Most ${c.company} ads don't state pay; only ${pct(c.disclosurePct)} do, so this is a partial picture.`);
  if (thinRoles.length) gaps.push(`Not enough salaried postings yet to publish a median for: ${thinRoles.slice(0, 6).join(", ")}.`);
  if (c.latest.length === 0) gaps.push("No advertised salary ranges we could verify right now.");
  gaps.push("No bonus, equity, benefits or headcount — we only read advertised base pay.");

  const compareHref = `/compare?companies=${[c.slug, ...c.peers.map((p) => p.slug)].join(",")}`;

  // Tabs mirror the sections that actually render — no anchors to nowhere.
  // Overview/Salaries/Roles/Jobs are always present; Locations is gated on markets.
  const sectionIds = new Set(["overview", "salaries", "roles", "jobs"]);
  if (c.markets.length > 0) sectionIds.add("locations");
  const tabs = COMPANY_TABS.filter((t) => sectionIds.has(t.id));

  // "Thin" pages: the companies board floor is n>=3, so a literal n<3 never renders,
  // and low-n pages (e.g. 3 of 45 ads disclose) still publish a median — flagging those
  // would contradict the header. The real "lonely" signal is a sparse body: <=2 role
  // families means the page has almost nothing below the fold. Give those one honest,
  // deliberate module inviting contributions.
  const earlyCoverage = c.roles.length <= 2;

  return (
    <div className="pb-4">
      <div className="pt-8"><Breadcrumbs items={[
        { label: "Companies", href: "/companies" },
        { label: c.sector, href: `/leaderboards?sector=${encodeURIComponent(c.sector)}#by-sector` },
        { label: c.company },
      ]} /></div>

      {/* Header */}
      <header className="mt-6 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="flex items-center gap-4">
          <CompanyLogo name={c.company} size={56} rounded="rounded-2xl" />
          <div>
            <h1 className="t-h2">{c.company}</h1>
            {meta.description && <p className="mt-1.5 max-w-md text-[13px] leading-snug text-ink-muted">{meta.description}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {chips.map((b) => <span key={b} className="rounded-full border px-2.5 py-0.5 text-[12px] text-ink-muted" style={{ background: "var(--surface-1)" }}>{b}</span>)}
              {/* Operating markets come from OUR data (countries with live ads),
                  never from config — so they can't go stale. */}
              {c.markets.length > 0 && (
                <a href="#locations" className="rounded-full border px-2.5 py-0.5 text-[12px] text-ink-muted hover:text-ink" style={{ background: "var(--surface-1)" }}>
                  Hiring in {c.markets.length} EMEA market{c.markets.length === 1 ? "" : "s"}
                </a>
              )}
              {meta.website && <a href={`https://${meta.website}`} target="_blank" rel="noopener noreferrer" className="rounded-full border px-2.5 py-0.5 text-[12px] text-ink-muted hover:text-ink" style={{ background: "var(--surface-1)" }}>{meta.website} ↗</a>}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 lg:w-[420px]">
          <div className="card !p-4 text-center">
            <div className="mx-auto"><ScoreBadge score={c.payScore} size="md" /></div>
            <div className="mt-2 text-[11px] text-ink-faint">Pay Score</div>
          </div>
          <div className="card !p-4">
            <div className="tnum text-2xl font-semibold">{c.sectorRank}/{c.sectorTotal}</div>
            <div className="mt-1 text-[11px] text-ink-faint">Sector rank{topPct ? ` · Top ${topPct}%` : ""}</div>
          </div>
          <div className="card !p-4">
            <div className="tnum text-2xl font-semibold" style={{ color: c.disclosurePct >= 50 ? "var(--mint)" : c.disclosurePct < 25 ? "var(--ember)" : undefined }}>{pct(c.disclosurePct)}</div>
            <div className="mt-1 text-[11px] text-ink-faint">Job ads that disclose pay · of {c.activeN} live</div>
          </div>
        </div>
      </header>

      {/* Action row */}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Link href={compareHref} className="pill-btn"><Icon.scale size={15} /><span>Compare</span></Link>
        <ShareButton />
        <span className="ml-auto text-[12px] text-ink-faint">Median advertised base <span className="tnum text-ink">{eur(c.midpoint)}</span> · from {c.n} salaried job ads · refreshed {timeAgo(refreshed)}</span>
      </div>

      {/* Tab bar */}
      <nav className="mt-6 flex flex-wrap gap-2 border-b pb-4" style={{ borderColor: "var(--border)" }} aria-label="Company sections">
        {tabs.map((t) => <a key={t.id} href={`#${t.id}`} className="pill-btn"><t.icon size={15} /><span>{t.label}</span></a>)}
      </nav>

      {/* 1. OPEN JOBS — what most people came for, moved up from the bottom. */}
      <section className="mt-10 scroll-mt-24" id="jobs">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <SectionHeader kicker="Open jobs" title="Latest salaried postings" />
          <span className="tnum text-[12px] text-ink-faint">
            {c.n} of {c.activeN} live ads disclose pay
          </span>
        </div>
        {c.latest.length > 0 ? (
          <div className="card mt-5">
            <PostingList postings={c.latest} sortable />
            <p className="mt-3 text-[12px] text-ink-faint">
              Only ads with a salary range we can verify appear here. Titles open {c.company}&rsquo;s own posting.
            </p>
          </div>
        ) : (
          <div className="card mt-5">
            <p className="text-sm text-ink-muted">
              No live {c.company} ad currently states a salary range we can verify. We track{" "}
              <span className="tnum text-ink">{c.activeN}</span> open role{c.activeN === 1 ? "" : "s"} here — the pay
              just isn&rsquo;t published on them.
            </p>
          </div>
        )}
      </section>

      {/* 2. ROLES — EVERY family with live ads, not only the salaried ones. */}
      <section className="mt-16 scroll-mt-24" id="roles">
        <SectionHeader
          kicker="Roles"
          title={`Roles ${c.company} hires for`}
          sub={`All ${c.roles.length} role famil${c.roles.length === 1 ? "y" : "ies"} with live job ads. Median shown where 3+ of them disclose pay.`}
        />
        <div className="card mt-5 !p-0">
          <div className="flex items-center gap-3 border-b px-4 py-2.5 text-[11px] text-ink-faint" style={{ borderColor: "var(--border)" }}>
            <span className="min-w-0 flex-1">Role family</span>
            <span className="w-16 shrink-0 text-right">Live ads</span>
            <span className="w-20 shrink-0 text-right">Disclose pay</span>
            <span className="w-24 shrink-0 text-right">Median base</span>
          </div>
          <ol>
            {c.roles.map((r) => (
              <li key={r.role} className="border-t" style={{ borderColor: "var(--border)" }}>
                <Link href={`/roles/${r.slug}`} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[var(--band)]">
                  <span className="min-w-0 flex-1 truncate">{familyLabel(r.role)}</span>
                  <span className="tnum w-16 shrink-0 text-right">{r.activeN}</span>
                  <span className="tnum w-20 shrink-0 text-right text-ink-muted">{r.salariedN || <span className="text-ink-faint">none</span>}</span>
                  <span className="tnum w-24 shrink-0 text-right font-semibold">
                    {r.companyMedian != null
                      ? eur(r.companyMedian)
                      : <span className="font-normal text-ink-faint">{r.salariedN === 0 ? "no disclosed pay" : `${r.salariedN}/3`}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 3. PAY VS MARKET. */}
      <section className="mt-16 scroll-mt-24" id="salaries">
        <SectionHeader kicker="Pay vs market" title="How each role compares" accent={`vs ${c.sector}.`} />
        <div className="card mt-5">
          <div className="flex items-center gap-2.5"><span className="icon-chip"><Icon.bars size={15} /></span><span className="text-[15px] font-semibold">Role vs {c.sector} market</span></div>
          <div className="mt-4 space-y-2.5">
            {c.roles.filter((r) => r.companyMedian != null).slice(0, 8).map((r) => {
              const ratio = r.companyMedian && r.sectorMedian ? r.companyMedian / r.sectorMedian : null;
              const w = ratio ? Math.min(100, ratio * 50) : 0;
              const above = ratio != null && ratio >= 1;
              return (
                <div key={r.role} className="flex items-center gap-3">
                  <Link href={`/roles/${r.slug}`} className="w-40 shrink-0 truncate text-sm hover:text-ink">{familyLabel(r.role)}</Link>
                  <span className="rank-track block min-w-0 flex-1"><span className="rank-fill" style={{ width: `${w}%`, background: above ? "var(--mint)" : "var(--accent)" }} /></span>
                  <span className="tnum w-24 shrink-0 text-right text-sm font-semibold">{eur(r.companyMedian!)}</span>
                </div>
              );
            })}
            {c.roles.every((r) => r.companyMedian == null) && (
              <p className="text-sm text-ink-faint">No role family here has 3+ salaried ads yet, so there is nothing to compare.</p>
            )}
          </div>
          <p className="mt-3 text-[12px] text-ink-faint">Bar is the company median relative to the {c.sector} median. A role needs 3+ salaried job ads.</p>
        </div>

        <Card className="mt-5 overflow-x-auto !p-0">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="text-left text-[12px] text-ink-faint">
                <th className="px-5 py-3 font-normal">Role family</th>
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
                    <td className="px-5 py-3"><Link href={`/roles/${r.slug}`} className="hover:text-ink">{familyLabel(r.role)}</Link><span className="tnum ml-2 text-xs text-ink-faint">{r.salariedN} salaried</span></td>
                    <td className="px-5 py-3 text-right tnum">{r.companyMedian ? eur(r.companyMedian) : <Link href={`/add?company=${encodeURIComponent(c.company)}`} className="text-xs font-medium hover:underline" style={{ color: "var(--accent)" }}>add yours →</Link>}</td>
                    <td className="px-5 py-3 text-right tnum text-ink-muted">{r.sectorMedian ? eur(r.sectorMedian) : <span className="text-ink-faint">—</span>}</td>
                    <td className="px-5 py-3 text-right tnum" style={{ color: dColor }}>{delta == null ? "—" : `${delta >= 0 ? "+" : "−"}${eur(Math.abs(delta))}`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
        {c.history.length >= 2 && <Card className="mt-5"><div className="mb-3 text-[13px] font-medium">Median advertised base over time</div><Sparkline history={c.history} /></Card>}
      </section>

      {/* 4. TRANSPARENCY. */}
      <section className="mt-16 scroll-mt-24" id="transparency">
        <SectionHeader kicker="Transparency" title={`What ${c.company} publishes`} />
        <div className="card mt-5">
          <div className="flex items-center gap-2.5"><span className="icon-chip"><Icon.shield size={15} /></span><span className="text-[15px] font-semibold">Transparency breakdown</span></div>
          <div className="mt-4 space-y-3">
            {subScores.map((s) => (
              <div key={s.label} className="flex items-center gap-3">
                <span className="w-28 shrink-0 text-sm">{s.label}</span>
                <span className="min-w-0 flex-1 truncate text-[12px] text-ink-faint">{s.note}</span>
                <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ color: tierColor(s.tier), background: `${tierColor(s.tier)}1a` }}>{s.tier}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[12px] text-ink-faint">Based on {c.activeN} live job ads. No verified employee submissions yet.</p>
        </div>
      </section>

      {/* 5. WHERE THEY HIRE. */}
      {c.markets.length > 0 && (
        <section className="mt-16 scroll-mt-24" id="locations">
          <SectionHeader kicker="Locations" title={`Where ${c.company} hires`} sub="Live job ads by country. Median shown where 3+ disclose pay; dots mark office cities. Click a market for this company's ads there." />
          <div className="mt-5">
            <CompanyHiresMap
              company={c.company}
              markets={c.markets}
              offices={c.offices}
              postingsByCountry={c.postingsByCountry}
              alsoOperates={c.alsoOperates}
            />
          </div>
        </section>
      )}

      {earlyCoverage && (
        <section className="mt-10">
          <div className="card flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2.5">
              <span className="icon-chip"><Icon.spark size={15} /></span>
              <div>
                <div className="text-[15px] font-semibold">Early coverage</div>
                <p className="mt-1 max-w-prose text-[14px] text-ink-muted">
                  We track {c.activeN} live job ad{c.activeN === 1 ? "" : "s"} at {c.company}
                  {c.n > 0 && c.n < c.activeN ? <>, {c.n} disclosing pay</> : null}, across just {c.roles.length} role famil{c.roles.length === 1 ? "y" : "ies"}.
                  Coverage is still early here — help us sharpen it. Know a number?
                </p>
              </div>
            </div>
            <Link href={`/add?company=${encodeURIComponent(c.company)}`} className="pill-btn shrink-0"><span>Add yours</span><span className="arw">→</span></Link>
          </div>
        </section>
      )}

      {/* Approved community submissions for THIS company. Hidden entirely
          below 3, and shown as bands — never the figure someone sent us. */}
      <CommunityActivity
        entries={community}
        title={`Recently added by ${c.company} employees`}
        showCompany={false}
        className="mt-16"
      />

      {c.peers.length > 0 && <PeerCompare c={c} />}
      <SectorContext c={c} />

      {/* What we don't know */}
      <section className="mt-16">
        <div className="card">
          <div className="flex items-center gap-2.5"><span className="icon-chip"><Icon.eye size={15} /></span><span className="text-[15px] font-semibold">What we don&rsquo;t know</span></div>
          <ul className="mt-4 space-y-2 text-sm text-ink-muted">
            {gaps.map((g, i) => <li key={i} className="flex gap-2"><span className="text-ink-faint">—</span><span>{g}</span></li>)}
          </ul>
        </div>
      </section>

      {/* UK Gender Pay Gap context (employer-reported; never in our medians) */}
      <GpgModule slug={c.slug} />

      {/* Compare CTA band */}
      <section className="section-y">
        <div className="band-dark flex flex-col gap-6 p-8 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-xl font-bold text-white">See how {c.company} compares</h3>
            <p className="mt-2 text-[14px]" style={{ color: "rgba(255,255,255,.72)" }}>Line {c.company} up against its peers on median base and transparency.</p>
          </div>
          <Link href={compareHref} className="pill-btn pill-btn-light shrink-0"><span>Compare companies</span><span className="arw">→</span></Link>
        </div>
      </section>
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
          {w.description && <p className="mt-1.5 max-w-md text-[13px] leading-snug text-ink-muted">{w.description}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 text-sm text-ink-muted">
            <span>{w.sector}</span>
            {w.hqCity && <><span className="text-ink-faint/60">·</span><span>{w.hqCity}</span></>}
            <span className="text-ink-faint/60">·</span>
            <a href={`https://${w.domain}`} target="_blank" rel="noopener noreferrer" className="hover:text-ink">{w.domain} ↗</a>
          </div>
        </div>
      </div>

      <Card className="mt-6">
        <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
          <Stat label="Pay Score" value={<span className="text-ink-faint">—</span>} />
          <Stat label="Median advertised base" value={<span className="text-ink-faint">No data</span>} />
          <Stat label="Salaried job ads" value={<span className="tnum">0</span>} />
          <Stat label="Job ads that disclose pay" value={<span className="text-ink-faint">Unknown</span>} />
        </div>
      </Card>

      <section className="mt-10 max-w-2xl">
        <div className="text-[11px] text-ink-faint">Why no numbers</div>
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

      {/* UK Gender Pay Gap context — often the only real pay-adjacent public data
          for these household-name watchlist employers. Clearly sourced, separate. */}
      <GpgModule slug={slugify(w.name)} />
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
              <th className="px-5 py-3 text-right font-normal">Median advertised base</th>
              <th className="px-5 py-3 text-right font-normal">Ads disclosing pay</th>
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
