import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/blocks";
import { RoleRequestForm } from "@/components/RoleRequestForm";
import { PostingList } from "@/components/PostingList";
import { Icon } from "@/components/icons";
import { matchInfo } from "@/lib/roleRequests";

export const metadata: Metadata = {
  title: "Request a role",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

export default async function RequestPage({ searchParams }: { searchParams: { q?: string } }) {
  const query = (searchParams.q || "").trim().slice(0, 120);
  // Resolved before the form is even shown: if the query IS a family we already
  // benchmark, the honest answer is a link to that page, not an email capture.
  const match = query ? await matchInfo(query) : null;

  return (
    <div className="pb-8">
      <div className="pt-8"><Breadcrumbs items={[{ label: "Salaries", href: "/roles" }, { label: "Request a role" }]} /></div>
      <header className="mt-6 max-w-2xl">
        <span className="eyebrow-pill"><span className="eyebrow">Coverage request</span></span>
        <h1 className="t-h2 mt-4">Ask us to track a <span className="accent-italic">role.</span></h1>
        <p className="mt-3 text-ink-muted">
          We scrape roughly everything on the boards we read — a &ldquo;new&rdquo; role is usually a new label on
          postings we already have, plus some targeted probing. Tell us what&rsquo;s missing.
        </p>
      </header>

      {!query ? (
        <section className="mt-6 max-w-2xl">
          <p className="text-ink-muted">No role specified. Search for a role and choose &ldquo;Request it&rdquo; when it isn&rsquo;t tracked yet.</p>
        </section>
      ) : (
        <div className="mt-6 max-w-2xl space-y-6">
          {/* Already benchmarked? Say so first and link straight through. */}
          {match?.exact && (
            <div className="card" style={{ borderColor: "var(--accent)", background: "var(--accent-soft)" }}>
              <div className="flex items-center gap-2.5">
                <span className="icon-chip"><Icon.check size={15} /></span>
                <div className="text-[15px] font-semibold">We already benchmark this</div>
              </div>
              <p className="mt-3 text-[14px] leading-relaxed text-ink-muted">
                <span className="font-medium text-ink">&ldquo;{query}&rdquo;</span> is our{" "}
                <span className="font-medium text-ink">{match.exact.label}</span> role family — medians by level,
                city, country and company are live now.
              </p>
              <div className="mt-4">
                <Link href={`/roles/${match.exact.slug}`} className="pill-btn">
                  <span>Open {match.exact.label}</span><span className="arw">→</span>
                </Link>
              </div>
            </div>
          )}

          <RoleRequestForm query={query} known={!!match?.exact} />

          {/* The evidence behind the count, before anyone hands over an email. */}
          {match && match.postings.length > 0 && (
            <section className="card">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="icon-chip"><Icon.briefcase size={15} /></span>
                  <span className="text-[15px] font-semibold">
                    {match.postings.length === match.matching
                      ? `${match.matching} live posting${match.matching === 1 ? "" : "s"} match “${query}”`
                      : `${match.postings.length} of ${match.matching.toLocaleString()} live postings matching “${query}”`}
                  </span>
                </div>
                <span className="text-[11px] text-ink-faint">Pay shown only where the ad disclosed it</span>
              </div>
              <div className="mt-3"><PostingList postings={match.postings} /></div>
            </section>
          )}

          {!match?.exact && match && match.families.length > 0 && (
            <section className="card">
              <div className="text-[13px] font-semibold">
                {match.families.length === 1 ? "Closest tracked role family" : "Closest tracked role families"}
              </div>
              <p className="mt-1 text-[12px] text-ink-faint">Where those postings already sit today.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {match.families.map((f) => (
                  <Link key={f.slug} href={`/roles/${f.slug}`} className="pill-btn">
                    <span>{f.label}</span>
                    <span className="tnum text-ink-faint">{f.n.toLocaleString()}</span>
                    <span className="arw">→</span>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
