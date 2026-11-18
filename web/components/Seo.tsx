// Visible SEO blocks that carry their own structured data. Each component
// renders the human-readable content AND its JSON-LD from one prop, so the two
// cannot disagree (see lib/seo).
import { ldJson, faqLd, type Faq, type RoundedSpread } from "@/lib/seo";

export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(data) }} />;
}

/** The answer-first lead: one self-contained, quotable sentence. */
export function AnswerLead({ text }: { text: string }) {
  return (
    <p className="answer-lead mt-6 max-w-3xl text-[17px] leading-relaxed text-ink" data-answer-lead>
      {text}
    </p>
  );
}

/** The percentile strip — the visible twin of estimatedSalary in the
 *  Occupation schema. Same RoundedSpread object feeds both. */
export function PercentileStrip({ spread, caption }: { spread: RoundedSpread; caption: string }) {
  const cells: [string, number][] = [
    ["10th percentile", spread.p10], ["25th percentile", spread.p25], ["Median", spread.median],
    ["75th percentile", spread.p75], ["90th percentile", spread.p90],
  ];
  return (
    <div className="card" data-percentiles>
      <div className="text-[15px] font-semibold">Advertised base salary range</div>
      <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-5">
        {cells.map(([label, v]) => (
          <div key={label}>
            <dt className="text-[11px] text-ink-faint">{label}</dt>
            <dd className={`tnum mt-1 text-lg ${label === "Median" ? "font-bold" : "font-semibold"}`}>{`€${v.toLocaleString("en-IE")}`}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-[12px] text-ink-faint">{caption}</p>
    </div>
  );
}

/** Computed FAQ, visible + FAQPage schema from the same array. */
export function FaqBlock({ faqs, title = "Frequently asked questions" }: { faqs: Faq[]; title?: string }) {
  if (faqs.length === 0) return null;
  return (
    <section className="mt-10" data-faq>
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="mt-4 divide-y rounded-card border" style={{ borderColor: "var(--border)" }}>
        {faqs.map((f) => (
          <div key={f.q} className="px-5 py-4" style={{ borderColor: "var(--border)" }}>
            <h3 className="text-[15px] font-semibold">{f.q}</h3>
            <p className="mt-1.5 text-[14px] leading-relaxed text-ink-muted">{f.a}</p>
          </div>
        ))}
      </div>
      <JsonLd data={faqLd(faqs)} />
    </section>
  );
}
