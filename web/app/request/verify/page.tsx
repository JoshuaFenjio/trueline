import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/blocks";
import { verifyRequest, matchInfo } from "@/lib/roleRequests";
import { RequestConfirmation } from "@/components/RequestConfirmation";

export const metadata: Metadata = { title: "Confirm your request — SalaryRadar", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function VerifyPage({ searchParams }: { searchParams: { e?: string; q?: string; t?: string } }) {
  const email = (searchParams.e || "").trim();
  const query = (searchParams.q || "").trim();
  const token = (searchParams.t || "").trim();
  const res = email && query && token ? await verifyRequest(email, query, token) : { ok: false };
  // Recomputed live at view time so the confirmation shows what we track NOW,
  // not the count frozen when the request was filed.
  const match = res.ok ? await matchInfo(res.query || query) : null;

  return (
    <div className="pb-8">
      <div className="pt-8"><Breadcrumbs items={[{ label: "Salaries", href: "/roles" }, { label: "Confirm request" }]} /></div>
      <section className="mt-8 max-w-2xl">
        {res.ok && match ? (
          <RequestConfirmation
            query={res.query || query}
            match={match}
            heading="Email confirmed"
            note="We’ll email you when this role has enough disclosed salaries to publish. One-tap unsubscribe in every mail."
          />
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
