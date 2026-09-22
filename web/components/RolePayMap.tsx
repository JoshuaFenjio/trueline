"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { EuropePayMap } from "@/components/EuropePayMap";
import { PostingList } from "@/components/PostingList";
import { Flag } from "@/components/Flag";
import { Icon } from "@/components/icons";
import type { EuropePayData } from "@/lib/data";
import type { PostingVM } from "@/lib/postings";
import { eur, slugify } from "@/lib/format";

/**
 * The EMEA pay map, scoped to one role family.
 *
 * Clicking a country opens the role × country view IN PLACE rather than
 * navigating to the generic country page, which would drop the role. That view
 * leads with the facts — median, rank among this role's markets, sample size,
 * top-paying employer — with the latest live ads for the role in that country
 * underneath, and the map below them. Everything is passed down pre-computed
 * and gated on the server; nothing is derived in the browser.
 */
export function RolePayMap({
  data, role, label, postingsByCountry, postingsHref,
}: {
  data: EuropePayData;
  role: string;
  label: string;
  postingsByCountry: Record<string, PostingVM[]>;
  postingsHref: string;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const rp = data.data[role] ?? data.data["All roles"];

  // Countries that clear the median gate for this role, best-paying first —
  // the rank shown in the facts strip.
  const ranked = useMemo(
    () => rp.countries.filter((c) => c.median != null).sort((a, b) => b.median! - a.median!),
    [rp]
  );

  const sel = picked ? rp.countries.find((c) => c.country === picked) ?? null : null;
  const rank = picked ? ranked.findIndex((c) => c.country === picked) : -1;
  const posts = picked ? postingsByCountry[picked] ?? [] : [];

  return (
    <div>
      {sel && (
        <div className="mb-6">
          {/* Facts first. */}
          <div className="card">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Flag country={sel.country} />
                <div>
                  <div className="text-[15px] font-semibold">{label} in {sel.country}</div>
                  <div className="text-[12px] text-ink-faint">Advertised base, live job ads only</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPicked(null)}
                className="text-[12px] text-ink-muted transition-colors hover:text-ink"
              >
                Clear ✕
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
              <Fact
                label="Median advertised base"
                value={sel.median != null ? eur(sel.median) : "—"}
                sub={sel.median != null ? undefined : `needs 8 salaried ads`}
              />
              <Fact
                label={`Rank for ${label}`}
                value={rank >= 0 ? `#${rank + 1}` : "—"}
                sub={rank >= 0 ? `of ${ranked.length} markets with a median` : "below the gate"}
              />
              <Fact label="Salaried job ads" value={sel.n.toLocaleString()} sub="behind this figure" />
              <Fact
                label="Top-paying employer"
                value={sel.topPayers[0]?.company ?? "—"}
                sub={sel.topPayers[0] ? eur(sel.topPayers[0].median) : "needs 3+ salaried ads"}
                small
              />
            </div>

            {sel.concentration && sel.concentration.share > 0.6 && (
              <p className="mt-3 text-[12px] text-ink-faint">
                Concentrated market — {Math.round(sel.concentration.share * 100)}% of these ads are{" "}
                {sel.concentration.company}.
              </p>
            )}

            {/* Latest role × country ads. */}
            <div className="mt-5 border-t pt-4" style={{ borderColor: "var(--border)" }}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="text-[13px] font-semibold">Latest {label} ads in {sel.country}</div>
                <Link href={`${postingsHref}?country=${encodeURIComponent(sel.country)}`} className="arrow-link inline-flex items-center gap-1 text-xs">
                  <span>See all</span><span className="arw">→</span>
                </Link>
              </div>
              <div className="mt-2">
                <PostingList postings={posts} emptyNote={`No dated ${label} ads in ${sel.country} right now.`} />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Link href={`/locations/country/${slugify(sel.country)}`} className="pill-btn">
                <Icon.globe size={14} /><span>All roles in {sel.country}</span><span className="arw">→</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Map lower. */}
      <EuropePayMap
        data={data}
        initialRole={role}
        hideRoleSelect
        withTable
        onCountryClick={(c) => setPicked((p) => (p === c ? null : c))}
        selectedCountry={picked}
      />
      <p className="mt-3 text-[12px] text-ink-faint">
        Click a country for {label} pay in that market. Medians need 8 salaried job ads.
      </p>
    </div>
  );
}

function Fact({ label, value, sub, small = false }: { label: string; value: string; sub?: string; small?: boolean }) {
  return (
    <div className="min-w-0">
      <div className={`tnum truncate font-semibold ${small ? "text-base" : "text-xl"}`}>{value}</div>
      <div className="mt-1 text-[11px] text-ink-faint">{label}</div>
      {sub && <div className="text-[11px] text-ink-faint">{sub}</div>}
    </div>
  );
}
