import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCountryDetail, getEuropePayData, countryFromSlug } from "@/lib/data";
import { SectionHeader, RankTable, toPayVMs, LevelLadder, Breadcrumbs, PillButton, GatedState } from "@/components/blocks";
import { EuropePayMap } from "@/components/EuropePayMap";
import { Donut } from "@/components/Donut";
import { Flag } from "@/components/Flag";
import { Icon } from "@/components/icons";
import { eur, slugify } from "@/lib/format";

export const revalidate = 3600;
export const dynamicParams = true;

export async function generateMetadata({ params }: { params: { country: string } }): Promise<Metadata> {
  const country = await countryFromSlug(params.country);
  if (!country) return { title: "Country not found" };
  const d = await getCountryDetail(country);
  const med = d.median ? eur(d.median) : "live data";
  const title = `Tech salaries in ${country} 2026, live from company job boards`;
  return {
    title,
    description: `What tech roles pay across ${country}: median ${med} base, by role, city and the top local payers. Real advertised salaries from live job boards.`,
    openGraph: { title, images: [`/og?kicker=${encodeURIComponent(country + " · EMEA")}&title=${encodeURIComponent("Salaries in " + country)}&value=${encodeURIComponent(d.median ? "Median " + med : "Live from job boards")}`] },
  };
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="card">
      <div className="flex items-center gap-2 text-[12px] text-ink-faint"><span className="text-[var(--accent)]">{icon}</span>{label}</div>
      <div className="tnum mt-2 text-2xl font-semibold">{value}</div>
      {sub && <div className="tnum mt-1 text-[12px] text-ink-faint">{sub}</div>}
    </div>
  );
}

export default async function CountryPage({ params }: { params: { country: string } }) {
  const country = await countryFromSlug(params.country);
  if (!country) notFound();
  const [d, europe] = await Promise.all([getCountryDetail(country), getEuropePayData()]);

  const nonOther = d.roleDist.filter((r) => r.role !== "Other");
  const top = nonOther.slice(0, 6);
  const restN = d.trackedN - top.reduce((s, r) => s + r.n, 0);
  const segments = [...top.map((r) => ({ label: r.role, value: r.n })), ...(restN > 0 ? [{ label: "Other", value: restN }] : [])];
  const otherPct = d.trackedN ? Math.round((restN / d.trackedN) * 100) : 0;
  const maxCompare = Math.max(1, ...d.compare.map((c) => c.median));

  return (
    <div className="pb-4">
      <div className="pt-8"><Breadcrumbs items={[{ label: "Salaries", href: "/locations" }, { label: "Countries", href: "/locations/countries" }, { label: country }]} /></div>

      {/* Header */}
      <section className="mt-6 grid items-start gap-8 lg:grid-cols-[1fr_1.05fr]">
        <div>
          <div className="flex items-center gap-3">
            <Flag country={country} className="!h-7 !w-10 !text-2xl" />
            <h1 className="t-h1">{country}</h1>
          </div>
          <p className="mt-4 max-w-lg text-lg leading-relaxed text-ink-muted">
            Real advertised pay for <span className="tnum text-ink">{d.rolesBenchmarked}</span> benchmarked role families from <span className="tnum text-ink">{d.companyCount}</span> companies across {country}.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <PillButton href="#cities">Explore salaries</PillButton>
            <Link href="/locations/countries" className="pill-btn"><Icon.scale size={15} /><span>Compare countries</span></Link>
          </div>
        </div>
        <div className="card !p-3">
          <EuropePayMap data={europe} highlightCountry={country} />
        </div>
      </section>

      {d.median == null ? (
        <section className="mt-8"><GatedState n={d.n} what={country} tracked={d.trackedN} /></section>
      ) : (
        <>
          {/* Stat row */}
          <section className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard icon={<Icon.bars size={15} />} label="Median base salary" value={eur(d.median)} sub={`${d.n} salaried postings`} />
            <StatCard icon={<Icon.briefcase size={15} />} label="Roles tracked" value={d.trackedN.toLocaleString()} sub={`${d.rolesBenchmarked} benchmarked`} />
            <StatCard icon={<Icon.shield size={15} />} label="Transparency" value={`${d.disclosurePct}%`} sub="of ads disclose pay" />
            <StatCard icon={<Icon.globe size={15} />} label="EMEA median rank" value={d.medianRank ? `#${d.medianRank}` : "—"} sub={d.medianRank ? `of ${d.total} countries` : undefined} />
          </section>

          {/* Three-column */}
          <section className="mt-8 grid gap-6 lg:grid-cols-3" id="cities">
            <div className="card">
              <div className="flex items-center gap-2.5"><span className="icon-chip"><Icon.pin size={15} /></span><span className="text-[15px] font-semibold">Top paying cities</span></div>
              <ol className="mt-4">
                {d.cities.length ? d.cities.map((c, i) => (
                  <li key={c.slug} className="border-t first:border-t-0" style={{ borderColor: "var(--border)" }}>
                    <Link href={`/locations/${c.slug}`} className="flex h-10 items-center gap-3 transition-colors hover:bg-[var(--band)]">
                      <span className="tnum w-5 text-right text-sm text-ink-faint">{i + 1}</span>
                      <span className="flex-1 truncate text-sm">{c.city} <span className="tnum text-[11px] text-ink-faint">n={c.n}</span></span>
                      <span className="tnum text-sm font-semibold">{eur(c.median)}</span>
                    </Link>
                  </li>
                )) : <li className="py-4 text-sm text-ink-faint">No city clears the gate yet.</li>}
              </ol>
            </div>
            <div className="card">
              <div className="flex items-center gap-2.5"><span className="icon-chip"><Icon.building size={15} /></span><span className="text-[15px] font-semibold">Top paying companies</span></div>
              <div className="mt-4">{d.companies.length ? <RankTable rows={toPayVMs(d.companies, (s) => `/companies/${s}`)} /> : <p className="text-sm text-ink-faint">Needs 3+ postings per company.</p>}</div>
            </div>
            <div className="card">
              <div className="flex items-center gap-2.5"><span className="icon-chip"><Icon.layers size={15} /></span><span className="text-[15px] font-semibold">Role distribution</span></div>
              <div className="mt-4">
                {otherPct > 40 ? (
                  <ul className="space-y-2 text-sm">
                    {segments.map((s) => (
                      <li key={s.label} className="flex items-center gap-2">
                        <span className="flex-1 truncate text-ink-muted">{s.label}</span>
                        <span className="tnum text-ink">{Math.round((s.value / d.trackedN) * 100)}%</span>
                      </li>
                    ))}
                  </ul>
                ) : <Donut segments={segments} centerLabel={d.trackedN.toLocaleString()} centerSub="roles" />}
              </div>
            </div>
          </section>

          {/* How country compares */}
          {d.compare.length > 1 && (
            <section className="mt-8">
              <div className="card">
                <div className="flex items-center gap-2.5"><span className="icon-chip"><Icon.bars size={15} /></span><span className="text-[15px] font-semibold">How {country} compares</span></div>
                <p className="mt-1 text-[13px] text-ink-faint">Median base salary versus the nearest markets.</p>
                <div className="mt-4 space-y-2.5">
                  {d.compare.map((c) => (
                    <div key={c.country} className="flex items-center gap-3">
                      <span className="flex w-36 items-center gap-2 truncate text-sm"><Flag country={c.country} /><span className={c.isSelf ? "font-semibold" : ""}>{c.country}</span></span>
                      <span className="rank-track block flex-1"><span className="rank-fill" style={{ width: `${(c.median / maxCompare) * 100}%`, background: c.isSelf ? "var(--accent)" : "var(--border-strong)" }} /></span>
                      <span className="tnum w-20 text-right text-sm font-semibold">{eur(c.median)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Comp by experience */}
          <section className="mt-8">
            <div className="card">
              <div className="flex items-center gap-2.5"><span className="icon-chip"><Icon.trending size={15} /></span><span className="text-[15px] font-semibold">Compensation by experience</span></div>
              <div className="mt-5 max-w-2xl"><LevelLadder items={d.byLevel.map((b) => ({ level: b.level, median: b.median, n: b.n }))} /></div>
            </div>
          </section>

          {/* Insights */}
          {d.insights.length > 0 && (
            <section className="mt-8">
              <SectionHeader kicker="Insights" title={`What the ${country} data shows`} />
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {d.insights.map((ins, i) => {
                  const I = (Icon as any)[ins.icon] ?? Icon.target;
                  return <div key={i} className="card"><span className="icon-chip"><I size={16} /></span><p className="mt-3 text-[14px] leading-relaxed text-ink-muted">{ins.text}</p></div>;
                })}
              </div>
            </section>
          )}
        </>
      )}

      {/* CTA band */}
      <section className="section-y grid gap-5 md:grid-cols-2">
        <div className="card flex flex-col gap-3">
          <div className="flex items-center gap-2.5"><span className="icon-chip"><Icon.scale size={15} /></span><span className="text-[15px] font-semibold">Compare countries</span></div>
          <p className="text-[14px] text-ink-muted">See how {country} ranks against every EMEA market by median base and transparency.</p>
          <div className="mt-1"><PillButton href="/locations/countries">All countries</PillButton></div>
        </div>
        <div className="card flex flex-col gap-3">
          <div className="flex items-center gap-2.5"><span className="icon-chip"><Icon.users size={15} /></span><span className="text-[15px] font-semibold">Add your salary</span></div>
          <p className="text-[14px] text-ink-muted">Sharpen the benchmark for {country} — anonymously, in a minute.</p>
          <div className="mt-1"><PillButton href="/add">Add your salary</PillButton></div>
        </div>
      </section>
    </div>
  );
}
