import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, PillButton } from "@/components/blocks";
import { Icon } from "@/components/icons";
import { verifyRequest } from "@/lib/roleRequests";

export const metadata: Metadata = { title: "Confirm your request — SalaryRadar", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function VerifyPage({ searchParams }: { searchParams: { e?: string; q?: string; t?: string } }) {
  const email = (searchParams.e || "").trim();
  const query = (searchParams.q || "").trim();
  const token = (searchParams.t || "").trim();
  const res = email && query && token ? await verifyRequest(email, query, token) : { ok: false };

  return (
    <div className="pb-8">
      <div className="pt-8"><Breadcrumbs items={[{ label: "Salaries", href: "/roles" }, { label: "Confirm request" }]} /></div>
      <section className="mt-8 max-w-xl">
        {res.ok ? (
          <div className="card">
            <div className="flex items-center gap-2.5"><span className="icon-chip"><Icon.check size={15} /></span>
              <div className="text-[15px] font-semibold">Email confirmed</div></div>
            <h1 className="t-h2 mt-3">Request logged.</h1>
            <p className="mt-3 max-w-prose text-[14px] leading-relaxed text-ink-muted">
              We already track <span className="tnum font-semibold text-ink">{(res.matching ?? 0).toLocaleString()}</span> live
              postings that may match <span className="font-medium text-ink">&ldquo;{res.query || query}&rdquo;</span>. We&rsquo;ll
              classify it and email you when it has enough disclosed salaries to publish. A new role is a new label on
              postings we largely already track — never a promise to summon data we don&rsquo;t have.
            </p>
            <div className="mt-5"><PillButton href="/roles">Browse tracked roles</PillButton></div>
          </div>
        ) : (
          <div className="card">
            <div className="text-[15px] font-semibold">Link invalid or expired</div>
            <p className="mt-3 text-[14px] text-ink-muted">
              We couldn&rsquo;t confirm this request. The link may be incomplete — try requesting the role again.
            </p>
            <div className="mt-5"><Link href="/roles" className="pill-btn"><span>Back to roles</span><span className="arw">→</span></Link></div>
          </div>
        )}
      </section>
    </div>
  );
}
