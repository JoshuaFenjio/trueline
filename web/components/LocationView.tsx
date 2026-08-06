import Link from "next/link";
import { LocationHub } from "@/lib/data";
import { SectionHeader, RankTable, toPayVMs, TrendBadge, GatedState, Breadcrumbs } from "@/components/blocks";
import { MeasureBar } from "@/components/MeasureBar";
import { Card } from "@/components/ui";
import { eur } from "@/lib/format";

export function LocationView({ hub, related = [] }: { hub: LocationHub; related?: { label: string; href: string }[] }) {
  const kindLabel = hub.kind === "city" ? "City" : "Country";
  const indexHref = hub.kind === "city" ? "/locations" : "/locations/countries";
  return (
    <div className="py-14">
      <Breadcrumbs items={[
        { label: "Salaries", href: "/roles" },
        { label: hub.kind === "city" ? "Cities" : "Countries", href: indexHref },
        { label: hub.name },
      ]} />
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <SectionHeader
          kicker={`${kindLabel} · ${hub.overall.n} salaried ads`}
          title={`What ${hub.name}`}
          accent="pays."
        />
        <div className="flex items-center gap-4">
          {hub.rank && (
            <div className="tnum text-sm text-ink-muted">
              #{hub.rank.pos}<span className="text-ink-faint"> of {hub.rank.total} EMEA {hub.kind === "city" ? "cities" : "countries"}</span>
            </div>
          )}
          <TrendBadge trend={hub.trend} />
        </div>
      </div>

      <section className="mt-8">
        {hub.overall.spread ? (
          <Card>
            <div className="text-sm text-ink-muted">
              All roles · median <span className="tnum text-ink">{eur(hub.overall.spread.median)}</span> base
            </div>
            <MeasureBar spread={hub.overall.spread} />
          </Card>
        ) : (
          <GatedState n={hub.overall.n} what={hub.name} tracked={hub.trackedN} />
        )}
      </section>

      <div className="mt-16 grid gap-12 md:grid-cols-2">
        <section>
          <SectionHeader kicker="By role" title="What each role earns here" />
          <div className="mt-5">
            {hub.byRole.length ? (
              <RankTable rows={toPayVMs(hub.byRole, (s) => `/roles/${s}`)} />
            ) : (
              <p className="text-sm text-ink-faint">No role clears the 8-posting gate here yet.</p>
            )}
          </div>
        </section>
        <section>
          <SectionHeader kicker="Local payers" title="Top payers here" />
          <div className="mt-5">
            {hub.topPayers.length ? (
              <RankTable rows={toPayVMs(hub.topPayers, (s) => `/companies/${s}`)} />
            ) : (
              <p className="text-sm text-ink-faint">Not enough per-company data here yet.</p>
            )}
          </div>
        </section>
      </div>

      {/* Related markets */}
      {related.length > 0 && (
        <section className="mt-16">
          <SectionHeader kicker="Related" title={hub.kind === "city" ? "Other cities" : "Other countries"} />
          <div className="mt-5 flex flex-wrap gap-2">
            {related.map((r) => (
              <Link key={r.href} href={r.href} className="rounded-full border px-3 py-1.5 text-sm text-ink-muted transition-colors hover:text-ink" style={{ background: "var(--surface-1)" }}>
                {r.label}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
