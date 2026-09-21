"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import type { PostingVM, PostingSort } from "@/lib/postings";
import { CompanyLogo } from "@/components/CompanyLogo";
import { Flag } from "@/components/Flag";
import { eurK, timeAgoMs } from "@/lib/format";

// One live-posting row, used everywhere a "latest postings" list appears. Pay is
// shown ONLY where the ad disclosed something we trust — otherwise the row says
// so plainly rather than implying a figure.
function payLabel(p: PostingVM): { text: string; muted: boolean } {
  if (p.lo != null && p.hi != null) {
    return { text: p.lo === p.hi ? eurK(p.lo) : `${eurK(p.lo)}–${eurK(p.hi)}`, muted: false };
  }
  if (p.midpoint != null) return { text: eurK(p.midpoint), muted: false };
  return { text: "No pay disclosed", muted: true };
}

export function PostingRow({ p }: { p: PostingVM }) {
  const pay = payLabel(p);
  const place = p.city || p.country || (p.remote ? "Remote" : null);
  const ago = timeAgoMs(p.dateMs);
  // Two independent destinations per row (the ad, and our company page), so the
  // row is deliberately NOT one big anchor — nesting them is invalid HTML and
  // breaks hydration.
  return (
    <li className="border-t transition-colors first:border-t-0 hover:bg-[var(--band)]" style={{ borderColor: "var(--border)" }}>
      <div className="flex items-start gap-3 px-1 py-3 sm:items-center">
        <CompanyLogo name={p.company} size={28} />
        <div className="min-w-0 flex-1">
          {p.url ? (
            <a
              href={p.url}
              target="_blank"
              rel="nofollow noopener"
              className="block truncate text-[14px] font-medium text-ink hover:text-[var(--accent)]"
            >
              {p.title}
            </a>
          ) : (
            <div className="truncate text-[14px] font-medium text-ink">{p.title}</div>
          )}
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-ink-faint">
            <Link href={`/companies/${p.companySlug}`} className="hover:text-ink">{p.company}</Link>
            {place && (
              <span className="flex items-center gap-1.5">
                <span className="text-ink-faint/50">·</span>
                <Flag country={p.country} />
                <span>{place}</span>
              </span>
            )}
            {ago && <><span className="text-ink-faint/50">·</span><span className="tnum">{ago}</span></>}
          </div>
        </div>
        <span
          className={`tnum shrink-0 text-right text-[13px] ${pay.muted ? "text-ink-faint" : "font-semibold text-ink"}`}
        >
          {pay.text}
        </span>
      </div>
    </li>
  );
}

/**
 * Sorted list of live postings. Sorting happens client-side over the rows the
 * server already rendered, so the default (newest) is in the SSR HTML and the
 * page stays statically cacheable.
 */
export function PostingList({
  postings, sortable = false, limit, emptyNote = "No live postings right now.",
}: {
  postings: PostingVM[]; sortable?: boolean; limit?: number; emptyNote?: string;
}) {
  const [sort, setSort] = useState<PostingSort>("new");
  const rows = useMemo(() => {
    const r = sort === "pay"
      ? [...postings].sort((a, b) => (b.midpoint ?? -1) - (a.midpoint ?? -1) || b.dateMs - a.dateMs)
      : postings;
    return limit ? r.slice(0, limit) : r;
  }, [postings, sort, limit]);

  if (postings.length === 0) return <p className="py-4 text-sm text-ink-faint">{emptyNote}</p>;

  return (
    <div>
      {sortable && (
        <div className="mb-1 flex items-center gap-2">
          <span className="text-[11px] text-ink-faint">Sort</span>
          <div className="inline-flex overflow-hidden rounded-full border" style={{ borderColor: "var(--border)" }}>
            {([{ k: "new", label: "Newest" }, { k: "pay", label: "Highest paying" }] as const).map((o) => (
              <button
                key={o.k}
                type="button"
                onClick={() => setSort(o.k)}
                className="px-3 py-1.5 text-xs"
                style={sort === o.k ? { background: "var(--accent)", color: "#fff" } : { color: "var(--ink-muted)" }}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}
      <ul>{rows.map((p, i) => <PostingRow key={(p.url ?? p.title) + i} p={p} />)}</ul>
    </div>
  );
}
