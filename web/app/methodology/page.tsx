import type { Metadata } from "next";
import { Breadcrumbs, PillButton } from "@/components/blocks";

export const metadata: Metadata = {
  title: "Methodology",
  description:
    "How Trueline builds its salary benchmarks: sources, base pay vs total comp, city-level data, sample gates, advertised vs offered, and how Pay Score works.",
};

const SECTIONS = [
  {
    id: "source",
    title: "Where the numbers come from",
    body: "Every figure is scraped from public job postings on companies’ own applicant tracking systems: Greenhouse, Lever, Ashby, SmartRecruiters, Recruitee and Teamtailor. We read the salary a company published itself. Where a posting exposes structured pay fields we use those; otherwise we parse the range conservatively from the job description and drop anything ambiguous.",
  },
  {
    id: "base-not-tc",
    title: "Base salary, not total comp",
    body: "We report advertised base salary only. Bonuses, equity and benefits vary too much to compare honestly from a job ad, so we leave them out rather than guess. A base figure you can trust beats a total-comp number we invented.",
  },
  {
    id: "city-level",
    title: "Why city, not country",
    body: "Pay in London, Paris, Berlin and Warsaw differs enormously within one country once you leave the capital. We anchor every benchmark to the city on the posting where we can, and only fall back to the country when no city is given.",
  },
  {
    id: "sample-gates",
    title: "Sample gates: when we stay quiet",
    body: "We never show a median from a handful of postings. A role-and-city query needs at least 8 recent salaried postings before we publish a number. Per-company medians need 3, per-city breakdowns need 5. Below the gate we say ‘not enough data yet’ instead of inventing a figure.",
  },
  {
    id: "advertised-vs-offered",
    title: "Advertised is not offered",
    body: "An advertised range is what a company is willing to state publicly. The offer you receive can land anywhere inside it, and occasionally outside. Treat these as market signal, not a promise. Verified salary submissions help close the gap between the two.",
  },
  {
    id: "who-pays",
    title: "How Pay Score works",
    body: "A company’s Pay Score is the percentile of its median advertised base against peers in the same sector, from 0 to 100. It is relative, not absolute: an 80 means ‘pays well for its sector’, not ‘pays the most in Europe’.",
  },
];

export default function MethodologyPage() {
  return (
    <div className="mx-auto max-w-2xl pb-4">
      <div className="pt-8"><Breadcrumbs items={[{ label: "Methodology" }]} /></div>
      <span className="eyebrow-pill mt-6"><span className="eyebrow">Methodology</span></span>
      <h1 className="t-h1 mt-5">How we know <span className="font-normal italic">what&rsquo;s true.</span></h1>
      <p className="mt-4 text-lg leading-relaxed text-ink-muted">
        Trueline is built to be honest about what it does and doesn&rsquo;t know. Here is exactly how the numbers are made.
      </p>

      <nav className="mt-8 flex flex-wrap gap-2">
        {SECTIONS.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="pill-btn">{s.title}</a>
        ))}
      </nav>

      <div className="mt-8 space-y-4">
        {SECTIONS.map((s, i) => (
          <section key={s.id} id={s.id} className="card scroll-mt-24">
            <div className="flex items-center gap-3">
              <span className="tnum flex h-7 w-7 items-center justify-center rounded-lg text-[13px] font-semibold" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>{i + 1}</span>
              <h2 className="text-[17px] font-semibold">{s.title}</h2>
            </div>
            <p className="mt-2.5 leading-relaxed text-ink-muted">{s.body}</p>
          </section>
        ))}
      </div>

      <section className="section-y">
        <div className="band-dark flex flex-col gap-6 p-8 md:flex-row md:items-center md:justify-between">
          <h2 className="text-xl font-bold text-white">See the honest numbers for yourself.</h2>
          <div className="flex gap-3"><PillButton href="/" light>Search the data</PillButton><PillButton href="/leaderboards" light>Leaderboards</PillButton></div>
        </div>
      </section>
    </div>
  );
}
