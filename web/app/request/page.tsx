import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/blocks";
import { RoleRequestForm } from "@/components/RoleRequestForm";

export const metadata: Metadata = {
  title: "Request a role — SalaryRadar",
  robots: { index: false },
};

export default function RequestPage({ searchParams }: { searchParams: { q?: string } }) {
  const query = (searchParams.q || "").trim().slice(0, 120);
  return (
    <div className="pb-8">
      <div className="pt-8"><Breadcrumbs items={[{ label: "Salaries", href: "/roles" }, { label: "Request a role" }]} /></div>
      <header className="mt-6 max-w-xl">
        <span className="eyebrow-pill"><span className="eyebrow">Coverage request</span></span>
        <h1 className="t-h2 mt-4">Ask us to track a <span className="accent-italic">role.</span></h1>
        <p className="mt-3 text-ink-muted">
          We scrape roughly everything on the boards we read — a &ldquo;new&rdquo; role is usually a new label on
          postings we already have, plus some targeted probing. Tell us what&rsquo;s missing.
        </p>
      </header>
      <section className="mt-6 max-w-xl">
        {query
          ? <RoleRequestForm query={query} />
          : <p className="text-ink-muted">No role specified. Search for a role and choose &ldquo;Request it&rdquo; when it isn&rsquo;t tracked yet.</p>}
      </section>
    </div>
  );
}
