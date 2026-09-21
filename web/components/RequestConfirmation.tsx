"use client";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { PostingList } from "@/components/PostingList";
import type { PostingVM } from "@/lib/postings";

export interface RequestMatchVM {
  matching: number;
  postings: PostingVM[];
  families: { name: string; label: string; slug: string; n: number }[];
  exact: { name: string; label: string; slug: string } | null;
}

/**
 * Confirmation for a role-coverage request. It SHOWS the postings it counts —
 * the claim "we already track N that may match" is only worth making if the
 * evidence is on the page — and routes the user to the actual family page(s)
 * those postings live in, not the generic hub.
 */
export function RequestConfirmation({
  query, match, heading = "Request logged", note,
}: {
  query: string;
  match: RequestMatchVM;
  heading?: string;
  note?: React.ReactNode;
}) {
  const { matching, postings, families, exact } = match;
  const shown = postings.length;

  return (
    <div className="card">
      <div className="flex items-center gap-2.5">
        <span className="icon-chip"><Icon.check size={15} /></span>
        <div className="text-[15px] font-semibold">{heading}</div>
      </div>

      {exact ? (
        <p className="mt-3 max-w-prose text-[14px] leading-relaxed text-ink-muted">
          Good news — we already benchmark this one. <span className="font-medium text-ink">“{query}”</span> is our{" "}
          <Link href={`/roles/${exact.slug}`} className="font-medium text-ink underline decoration-[var(--accent)] underline-offset-2">
            {exact.label}
          </Link>{" "}
          role family. We&rsquo;ve logged your request anyway so we can tighten how that page covers your exact title.
        </p>
      ) : (
        <p className="mt-3 max-w-prose text-[14px] leading-relaxed text-ink-muted">
          We already track{" "}
          <span className="tnum font-semibold text-ink">{matching.toLocaleString()}</span> live
          posting{matching === 1 ? "" : "s"} whose advertised title matches{" "}
          <span className="font-medium text-ink">“{query}”</span>. We&rsquo;ll classify it and email you when it has
          enough disclosed salaries to publish. A new role is a new label on postings we largely already track — we
          won&rsquo;t promise data we don&rsquo;t have.
        </p>
      )}

      {shown > 0 && (
        <div className="mt-5 border-t pt-4" style={{ borderColor: "var(--border)" }}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="text-[13px] font-semibold">
              {shown === matching
                ? `The ${shown} matching posting${shown === 1 ? "" : "s"}`
                : `The ${shown} most recent of ${matching.toLocaleString()} matches`}
            </div>
            <span className="text-[11px] text-ink-faint">Pay shown only where the ad disclosed it</span>
          </div>
          <div className="mt-2"><PostingList postings={postings} /></div>
        </div>
      )}

      {families.length > 0 && (
        <div className="mt-5 border-t pt-4" style={{ borderColor: "var(--border)" }}>
          <div className="text-[13px] font-semibold">
            {exact ? "Open the benchmark" : families.length === 1 ? "Closest tracked role family" : "Closest tracked role families"}
          </div>
          <p className="mt-1 text-[12px] text-ink-faint">
            {exact
              ? "Medians, levels, cities and the companies hiring."
              : "Where those postings already sit — each page has medians, levels and the companies hiring."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {families.map((f) => (
              <Link key={f.slug} href={`/roles/${f.slug}`} className="pill-btn">
                <span>{f.label}</span>
                <span className="tnum text-ink-faint">{f.n.toLocaleString()}</span>
                <span className="arw">→</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {note && <p className="mt-4 text-[13px] text-ink-faint">{note}</p>}

      <div className="mt-5">
        <Link href="/roles" className="arrow-link inline-flex items-center gap-1 text-xs">
          <span>Or browse every benchmarked role family</span><span className="arw">→</span>
        </Link>
      </div>
    </div>
  );
}
