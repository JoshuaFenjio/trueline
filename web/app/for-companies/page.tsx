import type { Metadata } from "next";
import { EmailCapture } from "@/components/EmailCapture";
import { Card } from "@/components/ui";
import { SectionHeader } from "@/components/blocks";

export const metadata: Metadata = {
  title: "For companies",
  description: "Benchmark your pay against your sector with live market data, set directive-ready ranges, and see how candidates rate your transparency. Join the waitlist.",
  openGraph: {
    title: "Trueline for companies",
    images: ["/og?kicker=For%20companies&title=Benchmark%20your%20pay&value=Live%20EMEA%20market%20data"],
  },
};

const FEATURES = [
  { k: "Benchmark", t: "Your pay vs your sector", d: "See where every role sits against real advertised ranges from your actual competitors, refreshed continuously." },
  { k: "Ranges", t: "Directive-ready bands", d: "Build pay ranges that hold up under the EU Pay Transparency Directive, grounded in live market medians rather than a stale survey." },
  { k: "Signal", t: "How candidates rate you", d: "Your Transparency score is public. See how disclosure moves the candidates who look at your roles." },
];

export default function ForCompanies() {
  return (
    <div className="py-16">
      <section className="max-w-2xl">
        <div className="tnum text-[11px] uppercase tracking-[0.22em] text-ink-faint">For companies</div>
        <h1 className="mt-3 text-4xl font-extrabold leading-[1.06] tracking-tight md:text-5xl">
          Know exactly what the market pays, before you <span>post.</span>
        </h1>
        <p className="mt-5 text-lg text-ink-muted">
          Trueline already reads the live salary market across EMEA. We&apos;re building the employer side:
          benchmark your bands against your real competitors and price roles with confidence.
        </p>
        <div className="mt-6 max-w-lg">
          <EmailCapture source="employer" withCompany cta="Join the waitlist" />
          <p className="mt-2 text-xs text-ink-faint">No spam. One email when the employer product is ready.</p>
        </div>
      </section>

      <section className="mt-20">
        <SectionHeader kicker="What you'll get" title="Priced on live data" />
        <div className="mt-7 grid gap-4 md:grid-cols-3">
          {FEATURES.map((f) => (
            <Card key={f.k} className="h-full">
              <div className="tnum text-[11px] uppercase tracking-[0.22em] text-ink-faint">{f.k}</div>
              <div className="mt-2 text-xl font-semibold">{f.t}</div>
              <p className="mt-2 text-sm text-ink-muted">{f.d}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-20 max-w-2xl">
        <Card>
          <h2 className="text-lg font-medium">Want your company benchmarked first?</h2>
          <p className="mt-2 text-sm text-ink-muted">Leave your work email and we&apos;ll start with your sector.</p>
          <div className="mt-4"><EmailCapture source="employer" withCompany cta="Join the waitlist" /></div>
        </Card>
      </section>
    </div>
  );
}
