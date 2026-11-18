import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/blocks";

export const metadata: Metadata = {
  title: "Insights",
  description: "Computed, citable statistics from SalaryRadar's live salary data.",
  alternates: { canonical: "/insights" },
};

export default function InsightsIndex() {
  return (
    <div className="mx-auto max-w-3xl pb-16">
      <div className="pt-8"><Breadcrumbs items={[{ label: "Insights" }]} /></div>
      <h1 className="t-h2 mt-6">Insights</h1>
      <p className="mt-3 text-ink-muted">Computed, citable statistics from the live data. Every figure is recalculated hourly.</p>
      <ul className="mt-8 space-y-3">
        <li className="card">
          <Link href="/insights/salary-transparency-statistics" className="text-[17px] font-semibold hover:text-[var(--accent)]">Salary transparency statistics</Link>
          <p className="mt-1 text-[14px] text-ink-muted">How many job ads state pay, by country and job-board platform, with medians by country and EU Pay Transparency Directive context.</p>
        </li>
      </ul>
    </div>
  );
}
