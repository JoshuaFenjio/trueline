import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCityDetail, cityFromSlug } from "@/lib/data";
import { SectionHeader, RankTable, toPayVMs, Breadcrumbs, PillButton, GatedState } from "@/components/blocks";
import { CitySilhouette } from "@/components/CitySilhouette";
import { Sparkline } from "@/components/Sparkline";
import { Flag } from "@/components/Flag";
import { Icon } from "@/components/icons";
import { eur, eurK, slugify } from "@/lib/format";

export const revalidate = 3600;
export const dynamicParams = true;

export async function generateMetadata({ params }: { params: { city: string } }): Promise<Metadata> {
  const city = await cityFromSlug(params.city);
  if (!city) return { title: "City not found" };
  const d = await getCityDetail(city);
  const med = d.median ? eur(d.median) : "live data";
  const title = `Tech salaries in ${city} 2026, live from company job boards`;
  return {
    title,
    description: `What tech roles pay in ${city}: median ${med} base, by role, and the top local payers. Real advertised salaries from live job boards.`,
    openGraph: { title, images: [`/og?kicker=${encodeURIComponent(city + " · EMEA")}&title=${encodeURIComponent("Salaries in " + city)}&value=${encodeURIComponent(d.median ? "Median " + med : "Live from job boards")}`] },
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

export default async function CityPage({ params }: { params: { city: string } }) {
  const city = await cityFromSlug(params.city);
  if (!city) notFound();
  const d = await getCityDetail(city);
  const vsCountry = d.median != null && d.countryMedian ? Math.round(((d.median - d.countryMedian) / d.countryMedian) * 100) : null;
  const maxRole = Math.max(1, ...d.topRoles.map((r) => r.median));

  return (
    <div className="pb-4">
      <div className="pt-8"><Breadcrumbs items={[{ label: "Salaries", href: "/locations" }, { label: "Cities", href: "/locations" }, { label: city }]} /></div>

      {/* Header — tinted panel with teal silhouette, no photo */}
      <section className="relative mt-6 overflow-hidden rounded-[20px] p-8" style={{ background: "var(--panel)" }}>
        <CitySilhouette className="pointer-events-none absolute inset-x-0 bottom-0 h-24 w-full" />
        <div className="relative">
          <div className="flex items-center gap-3">
            <Flag country={d.country} className="!h-6 !w-9 !text-xl" />
            <h1 className="t-h1">{city}</h1>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-ink-muted">
            {d.country && <Link href={`/locations/country/${slugify(d.country)}`} className="hover:text-[var(--accent)]">{d.country}</Link>}
            <span className="eyebrow-pill"><span className="eyebrow">{d.trackedN.toLocaleString()} roles tracked</span></span>
          </div>
        </div>
      </section>

      {d.median == null ? (
        <section className="mt-8"><GatedState n={d.n} what={city} tracked={d.trackedN} /></section>
      ) : (
        <>
          {/* Stat cards */}
          <section className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard icon={<Icon.bars size={15} />} label="Median base salary" value={eur(d.median)} sub={`${d.n} salaried postings`} />
            <StatCard icon={<Icon.briefcase size={15} />} label="Roles tracked" value={d.trackedN.toLocaleString()} sub={`${d.rolesBenchmarked} benchmarked`} />
            <StatCard icon={<Icon.target size={15} />} label="Sample size" value={d.n.toLocaleString()} sub="salaried postings" />
            <StatCard icon={<Icon.shield size={15} />} label="Transparency" value={`${d.disclosurePct}%`} sub="of ads disclose pay" />
          </section>

          {/* How city compares */}
          {(vsCountry != null || d.rankInCountry) && d.country && (
            <section className="mt-8">
              <div className="card flex flex-wrap items-center gap-6">
                <div className="flex items-center gap-2.5"><span className="icon-chip"><Icon.scale size={15} /></span><span className="text-[15px] font-semibold">How {city} compares</span></div>
                {vsCountry != null && <div><div className="tnum text-xl font-semibold" style={{ color: vsCountry >= 0 ? "var(--mint)" : "var(--ember)" }}>{vsCountry >= 0 ? "+" : ""}{vsCountry}%</div><div className="text-[12px] text-ink-faint">vs {d.country} median ({eur(d.countryMedian!)})</div></div>}
                {d.rankInCountry && <div><div className="tnum text-xl font-semibold">#{d.rankInCountry.pos}</div><div className="text-[12px] text-ink-faint">of {d.rankInCountry.total} {d.country} cities by median</div></div>}
              </div>
            </section>
          )}

          {/* Top roles + pay trend */}
          <section className="mt-8 grid gap-6 lg:grid-cols-2">
            <div className="card">
              <div className="flex items-center gap-2.5"><span className="icon-chip"><Icon.briefcase size={15} /></span><span className="text-[15px] font-semibold">Top paying roles in {city}</span></div>
              <ol className="mt-4">
                {d.topRoles.length ? d.topRoles.map((r, i) => (
                  <li key={r.slug} className="border-t first:border-t-0" style={{ borderColor: "var(--border)" }}>
                    <Link href={`/roles/${r.slug}`} className="flex h-11 items-center gap-3 transition-colors hover:bg-[var(--band)]">
                      <span className="tnum w-5 text-right text-sm text-ink-faint">{i + 1}</span>
                      <span className="min-w-0 flex-1"><span className="truncate text-sm">{r.role} <span className="tnum text-[11px] text-ink-faint">n={r.n}</span></span><span className="rank-track mt-1 block"><span className="rank-fill" style={{ width: `${(r.median / maxRole) * 100}%`, background: "var(--accent)" }} /></span></span>
                      <span className="tnum text-sm font-semibold">{eur(r.median)}</span>
                    </Link>
                  </li>
                )) : <li className="py-4 text-sm text-ink-faint">No role clears the gate yet.</li>}
              </ol>
            </div>
            <div className="card">
              <div className="flex items-center gap-2.5"><span className="icon-chip"><Icon.trending size={15} /></span><span className="text-[15px] font-semibold">Pay trend in {city}</span></div>
              {d.history.length >= 2 ? (
                <div className="mt-4">
                  <Sparkline values={d.history.map((h) => h.median)} width={480} height={120} className="w-full" />
                  <div className="tnum mt-2 flex justify-between text-[11px] text-ink-faint"><span>{d.history[0].month} · {eurK(d.history[0].median)}</span><span>{d.history[d.history.length - 1].month} · {eurK(d.history[d.history.length - 1].median)}</span></div>
                </div>
              ) : <p className="mt-4 text-sm text-ink-faint">Not enough monthly history yet to plot a trend. We show one once two months each clear the sample gate.</p>}
            </div>
          </section>

          {/* Top companies */}
          <section className="mt-8">
            <div className="card">
              <div className="flex items-center gap-2.5"><span className="icon-chip"><Icon.building size={15} /></span><span className="text-[15px] font-semibold">Top paying companies in {city}</span></div>
              <div className="mt-4">{d.topCompanies.length ? <RankTable rows={toPayVMs(d.topCompanies, (s) => `/companies/${s}`)} /> : <p className="text-sm text-ink-faint">Needs 3+ postings per company.</p>}</div>
            </div>
          </section>

          {/* Related markets */}
          {d.related.length > 0 && (
            <section className="mt-8">
              <SectionHeader kicker="Related" title={`Other ${d.country ?? "nearby"} cities`} />
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {d.related.map((r) => (
                  <Link key={r.slug} href={`/locations/${r.slug}`} className="card card-hover">
                    <div className="flex items-center gap-2"><Flag country={r.country} /><span className="truncate font-medium">{r.city}</span></div>
                    <div className="tnum mt-3 text-lg font-semibold">{eur(r.median)}</div>
                    <div className="tnum text-[12px] text-ink-faint">median base · n={r.n}</div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* Dual CTA */}
      <section className="section-y grid gap-5 md:grid-cols-2">
        <div className="card flex flex-col gap-3">
          <div className="flex items-center gap-2.5"><span className="icon-chip"><Icon.scale size={15} /></span><span className="text-[15px] font-semibold">Compare cities</span></div>
          <p className="text-[14px] text-ink-muted">See how {city} ranks against other European markets by median base.</p>
          <div className="mt-1"><PillButton href="/locations">All cities</PillButton></div>
        </div>
        <div className="card flex flex-col gap-3">
          <div className="flex items-center gap-2.5"><span className="icon-chip"><Icon.users size={15} /></span><span className="text-[15px] font-semibold">Add your salary</span></div>
          <p className="text-[14px] text-ink-muted">Sharpen the benchmark for {city} — anonymously, in a minute.</p>
          <div className="mt-1"><PillButton href="/add">Add your salary</PillButton></div>
        </div>
      </section>
    </div>
  );
}
