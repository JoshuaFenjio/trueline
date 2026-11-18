import type { Metadata } from "next";
import Link from "next/link";
import type { RolePlaceHub } from "@/lib/data";
import { SectionHeader, RankTable, toPayVMs, Breadcrumbs, PillButton, GatedState } from "@/components/blocks";
import { PostingList } from "@/components/PostingList";
import { Flag } from "@/components/Flag";
import { Icon } from "@/components/icons";
import { JsonLd, PercentileStrip } from "@/components/Seo";
import { familyLabel } from "@/lib/roleNames";
import { isManagementLevel } from "@/lib/levels";
import { eur, eurK, slugify } from "@/lib/format";
import { occupationLd, roundSpread, monthYear, robotsFor, currentYear, eurExact } from "@/lib/seo";
import { rolePlural, occupationEligible } from "@/lib/seoCopy";
import { CONCENTRATION_GATE } from "@/lib/payScale";

export function rolePlacePath(slug: string, kind: "city" | "country", placeSlug: string) {
  return `/roles/${slug}/${kind}/${placeSlug}`;
}

export function rolePlaceMetadata(hub: RolePlaceHub): Metadata {
  const label = familyLabel(hub.role);
  const sp = hub.overall.spread;
  const path = rolePlacePath(hub.slug, hub.kind, hub.placeSlug);
  const y = currentYear();
  const title = sp
    ? `${label} Salary in ${hub.place} ${y}: ${eurExact(sp.median)} median`
    : `${label} Salary in ${hub.place} ${y}: live job ads`;
  const description = sp
    ? `Median advertised base salary for ${rolePlural(hub.role)} in ${hub.place}: ${eurExact(sp.median)}, from ${sp.n} salaried live job ads (middle 50% ${eurExact(sp.p25)}–${eurExact(sp.p75)}). Live from company job boards.`
    : `${rolePlural(hub.role)} in ${hub.place}: ${hub.trackedN} live job ads tracked, not yet enough salaried ads (8) to publish a median.`;
  return {
    title, description,
    alternates: { canonical: path },
    robots: robotsFor(!!sp),
    openGraph: { title, images: [`/og?kicker=${encodeURIComponent(label + " · " + hub.place)}&title=${encodeURIComponent(label + " salaries")}&value=${encodeURIComponent(sp ? "Median " + eur(sp.median) : "Live from job boards")}`] },
  };
}

function StatCard({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="card">
      <div className="text-[12px] text-ink-faint">{label}</div>
      <div className="tnum mt-2 text-2xl font-semibold">{value}</div>
      {sub && <div className="tnum mt-1 text-[12px] text-ink-faint">{sub}</div>}
    </div>
  );
}

export function RolePlaceView({ hub, refreshed, lead, faq }: { hub: RolePlaceHub; refreshed: string | null; lead?: React.ReactNode; faq?: React.ReactNode }) {
  const label = familyLabel(hub.role);
  const plural = rolePlural(hub.role);
  const sp = hub.overall.spread;
  const path = rolePlacePath(hub.slug, hub.kind, hub.placeSlug);
  const placeHref = hub.kind === "city" ? `/locations/${hub.placeSlug}` : `/locations/country/${hub.placeSlug}`;
  const updated = monthYear(refreshed);
  const rs = sp ? roundSpread(sp) : null;
  const caption = rs
    ? `Annual advertised base salary percentiles for ${plural} in ${hub.place}, from ${rs.n} salaried live job ads tracked by SalaryRadar${updated ? ` (updated ${updated})` : ""}.`
    : "";
  const levels = hub.byLevel.filter((l) => l.median != null || (!isManagementLevel(l.level) && l.n > 0));
  const concentrated = hub.concentration && hub.concentration.share > CONCENTRATION_GATE ? hub.concentration : null;
  const vsRole = sp && hub.roleMedian ? Math.round(((sp.median - hub.roleMedian) / hub.roleMedian) * 100) : null;

  return (
    <div className="pb-4">
      <div className="pt-8">
        <Breadcrumbs items={[{ label: "Salaries", href: "/roles" }, { label, href: `/roles/${hub.slug}` }, { label: hub.place }]} />
      </div>

      <header className="mt-6">
        <div className="flex items-center gap-3">
          <Flag country={hub.country ?? hub.place} />
          <h1 className="t-h2">{label} salary in {hub.place}</h1>
        </div>
        <p className="mt-3 max-w-xl text-ink-muted">Advertised base pay for {plural} in {hub.place}, live from company job boards.</p>
        <div className="mt-3 flex flex-wrap gap-2 text-[12px]">
          <Link href={`/roles/${hub.slug}`} className="rounded-full border px-3 py-1 text-ink-muted hover:text-ink" style={{ background: "var(--surface-1)" }}>All {label} pay across EMEA</Link>
          <Link href={placeHref} className="rounded-full border px-3 py-1 text-ink-muted hover:text-ink" style={{ background: "var(--surface-1)" }}>All roles in {hub.place}</Link>
          {hub.kind === "city" && hub.country && (
            <Link href={rolePlacePath(hub.slug, "country", slugify(hub.country))} className="rounded-full border px-3 py-1 text-ink-muted hover:text-ink" style={{ background: "var(--surface-1)" }}>{label} in {hub.country}</Link>
          )}
        </div>
      </header>

      {!sp || !rs ? (
        <section className="mt-8 space-y-6">
          <GatedState n={hub.overall.n} what={`${label} in ${hub.place}`} tracked={hub.trackedN} />
          {hub.peers.length > 0 && (
            <div className="card">
              <div className="text-[15px] font-semibold">Where we can show {label} pay</div>
              <div className="mt-4"><RankTable rows={toPayVMs(hub.peers, (s) => rolePlacePath(hub.slug, hub.kind, s), { flags: true })} bars={false} /></div>
            </div>
          )}
        </section>
      ) : (
        <>
          {lead}
          <section className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Median advertised base" value={eurExact(rs.median)} sub={`from ${rs.n} salaried job ads`} />
            <StatCard label="Middle 50% of ads" value={`${eurK(rs.p25)}–${eurK(rs.p75)}`} sub="25th to 75th percentile" />
            <StatCard label="Live job ads tracked" value={hub.trackedN.toLocaleString()} sub={`${hub.disclosedN} disclose pay`} />
            <StatCard label={`vs ${label} across EMEA`} value={vsRole == null ? "—" : `${vsRole >= 0 ? "+" : ""}${vsRole}%`} sub={hub.roleMedian ? `EMEA median ${eur(hub.roleMedian)}` : undefined} />
          </section>

          <section className="mt-6"><PercentileStrip spread={rs} caption={caption} /></section>
          {concentrated && (
            <p className="mt-3 text-[13px] text-ink-muted">Note: {concentrated.company} supplies {Math.round(concentrated.share * 100)}% of the salaried ads behind this figure, so it leans towards one employer&rsquo;s pay bands.</p>
          )}

          <section className="mt-8 grid gap-6 lg:grid-cols-2">
            <div className="card">
              <div className="flex items-center gap-2.5"><span className="icon-chip"><Icon.bars size={15} /></span><span className="text-[15px] font-semibold">By seniority</span></div>
              <ol className="mt-4">
                {levels.map((l) => (
                  <li key={l.level} className="flex h-10 items-center gap-3 border-t first:border-t-0" style={{ borderColor: "var(--border)" }}>
                    <span className="flex-1 text-sm">{l.level}</span>
                    <span className="tnum text-sm text-ink-faint">{l.n} salaried</span>
                    <span className="tnum w-24 text-right text-sm font-semibold">{l.median != null ? eur(l.median) : "thin"}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-3 text-[12px] text-ink-faint">Levels only where the job title states one; a level needs 8 salaried ads.</p>
            </div>
            <div className="card">
              <div className="flex items-center gap-2.5"><span className="icon-chip"><Icon.building size={15} /></span><span className="text-[15px] font-semibold">Top paying companies</span></div>
              <div className="mt-4">{hub.topCompanies.length ? <RankTable rows={toPayVMs(hub.topCompanies, (s) => `/companies/${s}`)} bars={false} /> : <p className="text-sm text-ink-faint">Needs 3+ salaried ads per company.</p>}</div>
            </div>
          </section>

          {hub.cities.length > 0 && (
            <section className="mt-8">
              <SectionHeader kicker="Cities" title={`${label} pay by city in ${hub.place}`} />
              <div className="mt-5 card"><RankTable rows={toPayVMs(hub.cities, (s) => rolePlacePath(hub.slug, "city", s))} bars={false} /></div>
            </section>
          )}

          <section className="mt-8">
            <div className="card">
              <div className="text-[15px] font-semibold">Latest {label} job ads in {hub.place}</div>
              <p className="mt-1.5 text-[12px] text-ink-faint">Pay shown only where the ad disclosed it. Titles open the employer&rsquo;s own posting.</p>
              <div className="mt-3"><PostingList postings={hub.latest} sortable emptyNote="No dated ads right now." /></div>
            </div>
          </section>

          {faq}

          {occupationEligible(hub.role) && (
            <JsonLd data={occupationLd({
              name: label, path, description: caption, pageTitle: `${label} salary in ${hub.place}`,
              location: hub.kind === "city" ? { kind: "city", name: hub.place, country: hub.country } : { kind: "country", name: hub.place },
              spread: rs, lastRefreshedIso: refreshed,
            })} />
          )}
        </>
      )}

      {hub.peers.length > 0 && sp && (
        <section className="mt-8">
          <SectionHeader kicker="Compare" title={`${label} pay in other ${hub.kind === "city" ? "cities" : "countries"}`} />
          <div className="mt-5 card"><RankTable rows={toPayVMs(hub.peers, (s) => rolePlacePath(hub.slug, hub.kind, s), { flags: hub.kind === "city" })} bars={false} /></div>
        </section>
      )}

      <section className="section-y grid gap-5 md:grid-cols-2">
        <div className="card flex flex-col gap-3">
          <div className="text-[15px] font-semibold">{label} across Europe</div>
          <p className="text-[14px] text-ink-muted">Every level, country, city and company for {plural}.</p>
          <div className="mt-1"><PillButton href={`/roles/${hub.slug}`}>Open the {label} hub</PillButton></div>
        </div>
        <div className="card flex flex-col gap-3">
          <div className="text-[15px] font-semibold">How we calculate</div>
          <p className="text-[14px] text-ink-muted">Medians of advertised base salaries from live job ads, gated at 8 salaried ads, currency-normalised to EUR.</p>
          <div className="mt-1"><PillButton href="/methodology">Read the methodology</PillButton></div>
        </div>
      </section>
    </div>
  );
}
