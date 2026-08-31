"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Combobox } from "./Combobox";
import { Flag } from "./Flag";
import { eur, slugify } from "@/lib/format";
import type { EuropePayData } from "@/lib/data";

// Pick a role → EMEA countries re-rank by that role's median base. Same data and
// gate (n>=8) as the homepage Europe pay map's role selector, standalone here.
export function CountryRoleRanker({ data }: { data: EuropePayData }) {
  const [role, setRole] = useState("All roles");
  const rp = data.data[role] ?? data.data["All roles"];
  const ranked = useMemo(
    () => [...rp.countries].filter((c) => c.median != null).sort((a, b) => b.median! - a.median!),
    [rp]
  );
  const max = Math.max(1, ...ranked.map((c) => c.median!));

  return (
    <div className="surface rounded-card p-5">
      <div className="flex flex-wrap items-center gap-3">
        <Combobox
          options={data.roles}
          value={role}
          onChange={(v) => setRole(v || "All roles")}
          placeholder="All roles"
          clearValue="All roles"
          className="w-56"
          inputClassName="filter-pill w-full"
        />
        <span className="text-xs text-ink-faint">
          Ranked by median base for {role === "All roles" ? "all roles" : role} · gated at 8 salaried postings
        </span>
        <span className="tnum ml-auto text-xs text-ink-faint">EMEA median {eur(rp.emeaMedian)}</span>
      </div>
      <ol className="mt-4">
        {ranked.map((c, i) => (
          <li key={c.country} className="border-t first:border-t-0" style={{ borderColor: "var(--border)" }}>
            <Link
              href={`/locations/country/${slugify(c.country)}`}
              className="flex items-center gap-3 py-2.5 transition-colors hover:bg-[var(--band)]"
            >
              <span className="tnum w-5 shrink-0 text-right text-sm text-ink-faint">{i + 1}</span>
              <Flag country={c.country} />
              <span className="min-w-0 flex-1 truncate text-sm">{c.country}</span>
              <span className="mx-2 hidden w-40 sm:block">
                <span className="rank-track block"><span className="rank-fill" style={{ width: `${(c.median! / max) * 100}%` }} /></span>
              </span>
              <span className="tnum w-12 shrink-0 text-right text-xs text-ink-faint">n={c.n}</span>
              <span className="tnum w-24 shrink-0 text-right text-sm font-semibold">{eur(c.median!)}</span>
            </Link>
          </li>
        ))}
        {ranked.length === 0 && (
          <li className="py-6 text-center text-sm text-ink-faint">No country clears the 8-posting gate for this role yet.</li>
        )}
      </ol>
    </div>
  );
}
