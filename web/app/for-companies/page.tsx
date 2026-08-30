import type { Metadata } from "next";
import { EmailCapture } from "@/components/EmailCapture";
import { Breadcrumbs } from "@/components/blocks";
import { Icon } from "@/components/icons";

export const metadata: Metadata = {
  title: "For companies",
  description: "Benchmark your pay against your sector with live market data, set directive-ready ranges, and see how candidates rate your transparency. Join the waitlist.",
  openGraph: {
    title: "SalaryRadar for companies",
    images: ["/og?kicker=For%20companies&title=Benchmark%20your%20pay&value=Live%20EMEA%20market%20data"],
  },
};

const FEATURES = [
  { icon: Icon.bars, t: "Your pay vs your sector", d: "See where every role sits against real advertised ranges from your actual competitors, refreshed continuously." },
  { icon: Icon.scale, t: "Directive-ready bands", d: "Build pay ranges that hold up under the EU Pay Transparency Directive, grounded in live market medians rather than a stale survey." },
  { icon: Icon.shield, t: "How candidates rate you", d: "Your Transparency score is public. See how disclosure moves the candidates who look at your roles." },
];

export default function ForCompanies() {
  return (
    <div className="pb-4">
      <div className="pt-8"><Breadcrumbs items={[{ label: "For companies" }]} /></div>

      <section className="mt-6 max-w-2xl">
        <span className="eyebrow-pill"><span className="eyebrow">For companies</span></span>
        <h1 className="t-h1 mt-5">Know what the market pays, <span className="accent-italic">before you post.</span></h1>
        <p className="mt-4 text-lg leading-relaxed text-ink-muted">
          SalaryRadar already reads the live salary market across EMEA. We&rsquo;re building the employer side: benchmark your bands against your real competitors and price roles on live data.
        </p>
        <div className="mt-6 max-w-lg">
          <EmailCapture source="employer" withCompany cta="Join the waitlist" />
          <p className="mt-2 text-xs text-ink-faint">No spam. One email when the employer product is ready.</p>
        </div>
      </section>

      <section className="mt-14">
        <div className="grid gap-5 md:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.t} className="card h-full">
              <span className="icon-chip"><f.icon size={16} /></span>
              <div className="mt-3 text-[15px] font-semibold">{f.t}</div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section-y">
        <div className="band-dark flex flex-col gap-6 p-8 md:flex-row md:items-center md:justify-between">
          <div className="md:max-w-md">
            <h2 className="text-xl font-bold text-white">Get your company benchmarked first</h2>
            <p className="mt-2 text-[14px]" style={{ color: "rgba(255,255,255,.72)" }}>Leave your work email and we&rsquo;ll start with your sector.</p>
          </div>
          <div className="w-full md:w-96"><EmailCapture source="employer" withCompany cta="Join the waitlist" /></div>
        </div>
      </section>
    </div>
  );
}
