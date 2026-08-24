"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Flag } from "@/components/Flag";
import { eur } from "@/lib/format";

export interface HubItem { name: string; slug: string; median: number; n: number; flagCountry: string | null; href: string }

// Searchable tile grid for the location/role hubs. Filters the passed list
// client-side; all items are real gated entries computed on the server.
export function HubExplorer({ items, placeholder, unit = "roles" }: { items: HubItem[]; placeholder: string; unit?: string }) {
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? items.filter((i) => i.name.toLowerCase().includes(s)) : items;
  }, [q, items]);
  return (
    <div>
      <div className="relative max-w-sm">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} className="field w-full py-2.5 pl-9 pr-3 text-sm" aria-label={placeholder} />
        <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {shown.map((i) => (
          <Link key={i.slug} href={i.href} className="card card-hover !p-4">
            <div className="flex items-center gap-2"><Flag country={i.flagCountry} /><span className="truncate font-medium">{i.name}</span></div>
            <div className="tnum mt-2 text-lg font-semibold">{eur(i.median)}</div>
            <div className="tnum text-[12px] text-ink-faint">median base · {i.n} {unit}</div>
          </Link>
        ))}
      </div>
      {shown.length === 0 && <p className="mt-6 text-sm text-ink-faint">No matches for &ldquo;{q}&rdquo;.</p>}
    </div>
  );
}
