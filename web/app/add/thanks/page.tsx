import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/blocks";
import { Icon } from "@/components/icons";
import { InsightsOptIn } from "@/components/InsightsOptIn";
import { familyLabel } from "@/lib/roleNames";
import { roleFromSlug } from "@/lib/data";

export const metadata: Metadata = { title: "Thanks — your salary is in review", robots: { index: false } };
export const dynamic = "force-dynamic";

// What actually happens next, in order, with the real gate stated. No progress
// theatre, no "you've unlocked" — the submission is in a queue and a person
// reads it.
const STEPS = [
  { icon: Icon.eye, t: "A person reads it", d: "Every submission is reviewed by hand. We check it against the advertised ranges we already hold for that company and role, and reject anything that can't be real." },
  { icon: Icon.shield, t: "It stays anonymous", d: "Nothing you sent is ever shown as an individual data point, and it is never attributed to you. It only appears inside an aggregate." },
  { icon: Icon.bars, t: "It publishes at three", d: "A verified figure appears on a page once that exact slice — your role, level and city — has at least 3 approved submissions. Below that we show nothing, rather than a number one person could be identified from." },
  { icon: Icon.spark, t: "Bonus and equity stay separate", d: "If you added them, they're kept as total-comp context and shown separately. They never move a base-salary median." },
];

export default async function ThanksPage({ searchParams }: { searchParams: { role?: string; slug?: string } }) {
  const raw = (searchParams.role || "").slice(0, 80);
  const slug = (searchParams.slug || "").slice(0, 80);
  const known = slug ? await roleFromSlug(slug) : null;
  const label = raw ? familyLabel(raw) : "";

  return (
    <div className="mx-auto max-w-2xl pb-8">
      <div className="pt-8"><Breadcrumbs items={[{ label: "Add your salary", href: "/add" }, { label: "Thanks" }]} /></div>

      <header className="mt-6">
        <span className="eyebrow-pill"><span className="eyebrow">Submitted</span></span>
        <h1 className="t-h2 mt-4">Thank you — that genuinely helps.</h1>
        <p className="mt-3 text-ink-muted">
          {label
            ? <>Your {label} figure is in the review queue. Here&rsquo;s exactly what happens to it.</>
            : <>Your figure is in the review queue. Here&rsquo;s exactly what happens to it.</>}
        </p>
      </header>

      <section className="card mt-6">
        <ol className="space-y-5">
          {STEPS.map((s, i) => (
            <li key={s.t} className="flex gap-3">
              <span className="icon-chip mt-0.5 shrink-0"><s.icon size={15} /></span>
              <div className="min-w-0">
                <div className="text-[14px] font-semibold">{s.t}</div>
                <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">{s.d}</p>
              </div>
              <span className="tnum ml-auto shrink-0 text-[11px] text-ink-faint">{i + 1}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* Opt-in. One clearly-scoped ask, nothing pre-ticked, nothing required —
          the submission is already saved either way — and the unsubscribe
          promise sits with the button rather than in small print. */}
      <section className="card mt-6">
        <div className="flex items-center gap-2.5">
          <span className="icon-chip"><Icon.trending size={15} /></span>
          <span className="text-[15px] font-semibold">
            {label ? <>Get salary insights for {label}</> : <>Get salary insights for your role</>}
          </span>
        </div>
        <p className="mt-2 max-w-prose text-[14px] leading-relaxed text-ink-muted">
          We&rsquo;ll email you when the benchmark for {label || "your role"} moves — a new median, a new market, or
          enough verified submissions to publish one. Roughly once a month, and only when something actually changed.
        </p>
        <div className="mt-4"><InsightsOptIn role={raw} /></div>
      </section>

      <div className="mt-6 flex flex-wrap gap-2">
        {known && (
          <Link href={`/roles/${slug}`} className="pill-btn">
            <Icon.bars size={14} /><span>See the {label} benchmark</span><span className="arw">→</span>
          </Link>
        )}
        <Link href="/add" className="pill-btn"><span>Add another</span><span className="arw">→</span></Link>
        <Link href="/methodology" className="pill-btn"><span>How we use it</span><span className="arw">→</span></Link>
      </div>
    </div>
  );
}
