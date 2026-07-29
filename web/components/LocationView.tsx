import Link from "next/link";
import { LocationHub } from "@/lib/data";
import { SectionHeader, RankTable, toPayVMs, TrendBadge, GatedState } from "@/components/blocks";
import { MeasureBar } from "@/components/MeasureBar";
import { Card } from "@/components/ui";
import { eur } from "@/lib/format";

export function LocationView({ hub }: { hub: LocationHub }) {
  const kindLabel = hub.kind === "city" ? "City" : "Country";
  return (
    <div className="py-14">
      <div className="tnum text-xs text-ink-faint">
        <Link href="/leaderboards" className="hover:text-ink">Leaderboards</Link> / {kindLabel}
      </div>
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
    </div>
  );
}
