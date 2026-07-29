import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Methodology",
  description:
    "How Trueline builds its salary benchmarks: sources, base pay vs total comp, city-level data, sample gates, advertised vs offered, and how Pay Score works.",
};

const SECTIONS = [
  {
    id: "source",
    title: "Where the numbers come from",
    body: "Every figure is scraped from public job postings on companies' own applicant tracking systems (Greenhouse, Lever, Ashby, SmartRecruiters, Recruitee, Teamtailor). We read the salary a company itself published — structured pay fields where they exist, otherwise conservatively parsed from the job description. [Full copy to follow.]",
  },
  {
    id: "base-not-tc",
    title: "Base salary, not total comp",
    body: "We report advertised base salary only. Bonuses, equity, and benefits vary too much to compare honestly from a job ad, so we leave them out rather than guess. [Full copy to follow.]",
  },
  {
    id: "city-level",
    title: "Why city, not country",
    body: "Pay in London, Paris, Berlin and Warsaw differs enormously within the same country's borders once you leave the capital. We anchor benchmarks to the city on the posting wherever possible. [Full copy to follow.]",
  },
  {
    id: "sample-gates",
    title: "Sample gates — when we stay quiet",
    body: "We never show a median from a handful of postings. A role-and-city query needs at least 8 recent salaried postings before we show a number; per-company medians need 3, per-city breakdowns need 5. Below that, we say 'not enough data yet'. [Full copy to follow.]",
  },
  {
    id: "advertised-vs-offered",
    title: "Advertised ≠ offered",
    body: "An advertised range is what a company is willing to say publicly — the offer you receive can land anywhere inside (or occasionally outside) it. Treat these as market signal, not a promise. Verified user submissions help close that gap. [Full copy to follow.]",
  },
  {
    id: "who-pays",
    title: "How Pay Score works",
    body: "A company's Pay Score is the percentile of its median advertised base against peers in the same sector — 0 to 100. It's relative, not absolute: an 80 means 'pays well for its sector', not 'pays the most in Europe'. [Full copy to follow.]",
  },
];

export default function MethodologyPage() {
  return (
    <div className="mx-auto max-w-2xl py-12">
      <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
        How we know what&apos;s <span className="serif-accent gradient-text">true.</span>
      </h1>
      <p className="mt-3 text-ink-muted">
        Trueline is built to be honest about what it does and doesn&apos;t know. Here&apos;s exactly how the numbers are made.
      </p>

      <nav className="mt-8 flex flex-wrap gap-2">
        {SECTIONS.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="rounded-full border px-3 py-1.5 text-xs text-ink-muted transition-colors hover:text-ink" style={{ background: "var(--surface-1)" }}>
            {s.title}
          </a>
        ))}
      </nav>

      <div className="mt-10 space-y-10">
        {SECTIONS.map((s, i) => (
          <section key={s.id} id={s.id} className="scroll-mt-20">
            <div className="tnum text-xs text-ink-faint">0{i + 1}</div>
            <h2 className="mt-1 text-xl font-medium">{s.title}</h2>
            <p className="mt-2 leading-relaxed text-ink-muted">{s.body}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
