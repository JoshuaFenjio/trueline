import type { Metadata } from "next";
import { getLeaderboards, countriesForRole, isConfigured } from "@/lib/data";
import { SectionHeader, RankTable, toPayVMs, Chip, RankVM } from "@/components/blocks";
import { scoreColor } from "@/components/ui";
import { slugify, pct } from "@/lib/format";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Salary leaderboards — who pays most in EMEA (2026)",
  description:
    "Live leaderboards of the top-paying tech companies in Europe, the Middle East and Africa — overall, by sector, by role, by country, and the most transparent employers. From real job-board data.",
  openGraph: {
    title: "EMEA salary leaderboards — who pays most",
    images: ["/og?kicker=Leaderboards&title=Who%20pays%20most%20in%20EMEA&value=Live%20from%20job%20boards"],
  },
};

function href(base: string, patch: Record<string, string>, current: Record<string, string | undefined>, anchor: string) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...current, ...patch })) if (v) p.set(k, v);
  return `${base}?${p.toString()}#${anchor}`;
}

export default async function Leaderboards({
  searchParams,
}: {
  searchParams: { sector?: string; role?: string; crole?: string };
}) {
  if (!isConfigured) return <p className="py-24 text-center text-ink-muted">Supabase not configured.</p>;
  const lb = await getLeaderboards();

  const sector = searchParams.sector || lb.bySector[0]?.sector;
  const role = searchParams.role || lb.byRole[0]?.role;
  const crole = searchParams.crole || lb.roles[0];
  const sectorRows = lb.bySector.find((s) => s.sector === sector)?.rows || [];
  const roleRows = lb.byRole.find((r) => r.role === role)?.rows || [];
  const countryRows = crole ? await countriesForRole(crole) : [];

  const disclosureVMs: RankVM[] = lb.bestDisclosure.map((d) => ({
    label: d.company, href: `/companies/${d.slug}`, sub: `${d.activeN} ads`,
    valueLabel: pct(d.pct), barPct: d.pct / 100, tone: scoreColor(d.pct),
  }));

  const cur = { sector: searchParams.sector, role: searchParams.role, crole: searchParams.crole };

  return (
    <div className="py-14">
      <SectionHeader
        kicker="Leaderboards"
        title="Who actually pays"
        accent="most."
        sub="Live rankings from real EMEA job-board data. Every company, role and country here is a link. Medians need 8+ postings; company midpoints need 3+."
      />

      {/* 1. Overall */}
      <section className="mt-16" id="overall">
        <SectionHeader kicker="01 · Overall" title="Top-paying companies" id="overall" />
        <div className="mt-6">
          <RankTable rows={toPayVMs(lb.topCompanies, (s) => `/companies/${s}`)} />
        </div>
      </section>

      {/* 2. By sector */}
      <section className="mt-24" id="by-sector">
        <SectionHeader kicker="02 · By sector" title="Top payers by sector" />
        <div className="mt-5 flex flex-wrap gap-2">
          {lb.bySector.map((s) => (
            <Chip key={s.sector} href={href("/leaderboards", { sector: s.sector }, cur, "by-sector")} active={s.sector === sector}>
              {s.sector}
            </Chip>
          ))}
        </div>
        <div className="mt-6">
          <RankTable rows={toPayVMs(sectorRows, (s) => `/companies/${s}`)} />
        </div>
      </section>

      {/* 3. By role */}
      <section className="mt-24" id="by-role">
        <SectionHeader kicker="03 · By role" title="Who pays this role most" />
        <div className="mt-5 flex flex-wrap gap-2">
          {lb.byRole.map((r) => (
            <Chip key={r.role} href={href("/leaderboards", { role: r.role }, cur, "by-role")} active={r.role === role}>
              {r.role}
            </Chip>
          ))}
        </div>
        <div className="mt-6">
          <RankTable rows={toPayVMs(roleRows, (s) => `/companies/${s}`)} />
        </div>
        {role && (
          <p className="mt-3 text-sm text-ink-faint">
            See the full <a className="underline hover:text-ink" href={`/roles/${slugify(role)}`}>{role} role hub →</a>
          </p>
        )}
      </section>

      {/* 4. Countries by role */}
      <section className="mt-24" id="countries">
        <SectionHeader kicker="04 · By country" title="Which countries pay most" accent="— by role." />
        <div className="mt-5 flex flex-wrap gap-2">
          {lb.roles.map((r) => (
            <Chip key={r} href={href("/leaderboards", { crole: r }, cur, "countries")} active={r === crole}>
              {r}
            </Chip>
          ))}
        </div>
        <div className="mt-6">
          {countryRows.length ? (
            <RankTable rows={toPayVMs(countryRows, (s) => `/locations/country/${s}`)} valueHead={`${crole} median`} />
          ) : (
            <p className="py-6 text-sm text-ink-faint">No country clears the 8-posting gate for {crole} yet.</p>
          )}
        </div>
      </section>

      {/* 5. Best disclosure */}
      <section className="mt-24" id="transparent">
        <SectionHeader kicker="05 · Transparency" title="Most transparent employers" sub="Share of active ads that state a salary. Companies with 10+ live postings." />
        <div className="mt-6">
          <RankTable rows={disclosureVMs} valueHead="% ads w/ pay" />
        </div>
      </section>
    </div>
  );
}
