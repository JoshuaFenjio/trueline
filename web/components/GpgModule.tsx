import { gpgFor } from "@/lib/gpgData";
import { Icon } from "@/components/icons";

// UK Gender Pay Gap context module. Employer-reported public data (gov.uk),
// shown as clearly-sourced context — NEVER blended into our advertised-salary
// medians. Renders nothing for companies without a filing.
export function GpgModule({ slug }: { slug: string }) {
  const g = gpgFor(slug);
  if (!g) return null;

  const quartiles = [
    { label: "Top (highest paid)", women: g.womenByQuartile.top },
    { label: "Upper-middle", women: g.womenByQuartile.upperMiddle },
    { label: "Lower-middle", women: g.womenByQuartile.lowerMiddle },
    { label: "Lower (lowest paid)", women: g.womenByQuartile.lower },
  ];
  const gap = g.medianGapPct;

  return (
    <section className="mt-10">
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="icon-chip"><Icon.scale size={15} /></span>
            <div>
              <div className="eyebrow">UK Gender Pay Gap · {g.year}</div>
              <div className="text-[15px] font-semibold">Company-reported pay quartiles</div>
            </div>
          </div>
          {gap != null && (
            <div className="text-right">
              <div className="tnum text-2xl font-semibold">{gap > 0 ? "+" : ""}{gap}%</div>
              <div className="text-[11px] text-ink-faint">median hourly gap</div>
            </div>
          )}
        </div>

        <p className="mt-3 max-w-prose text-[13px] leading-relaxed text-ink-muted">
          Share of women in each hourly-pay quartile of {g.employer}&rsquo;s UK workforce
          {g.employerSize ? ` (${g.employerSize} employees)` : ""}, self-reported under the UK
          Gender Pay Gap regulations. A positive median gap means women&rsquo;s median hourly pay
          is lower than men&rsquo;s. This is employer-reported headcount data — not advertised
          salaries, and not used in any SalaryRadar median.
        </p>

        <div className="mt-5 space-y-2.5">
          {quartiles.map((q) => (
            <div key={q.label} className="flex items-center gap-3">
              <span className="w-40 shrink-0 text-[12px] text-ink-muted">{q.label}</span>
              <div className="flex h-6 flex-1 overflow-hidden rounded-md" style={{ background: "var(--surface-2)" }}>
                {q.women != null && (
                  <>
                    <div className="flex items-center justify-end pr-1.5" style={{ width: `${q.women}%`, background: "var(--accent)" }}>
                      {q.women >= 18 && <span className="tnum text-[10px] font-semibold text-white">{Math.round(q.women)}%♀</span>}
                    </div>
                    <div className="flex items-center pl-1.5" style={{ width: `${100 - q.women}%` }}>
                      {100 - q.women >= 18 && <span className="tnum text-[10px] text-ink-faint">{Math.round(100 - q.women)}%♂</span>}
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 border-t pt-3 text-[11px] text-ink-faint" style={{ borderColor: "var(--border)" }}>
          Source: {g.employer} · UK Gender Pay Gap filing {g.year} ·{" "}
          <a href={g.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-ink">gov.uk</a>
        </div>
      </div>
    </section>
  );
}
