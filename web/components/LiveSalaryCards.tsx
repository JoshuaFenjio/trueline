import Link from "next/link";
import type { LiveCard } from "@/lib/data";
import { CompanyLogo } from "@/components/CompanyLogo";
import { origPay, timeAgoShort } from "@/lib/format";

// Proof-of-life: the most recent real salaried postings, original currency.
export function LiveSalaryCards({ cards, viewAllHref = "/roles" }: { cards: LiveCard[]; viewAllHref?: string }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      <Link
        href="/add"
        className="flex min-w-[168px] flex-1 flex-col items-center justify-center rounded-xl border border-dashed px-4 py-4 text-center transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
        style={{ borderColor: "var(--border-strong)", color: "var(--ink-muted)" }}
      >
        <span className="text-lg leading-none">+</span>
        <span className="mt-1.5 text-sm font-medium">Add your salary</span>
      </Link>

      {cards.map((c) => (
        <Link
          key={c.slug + c.role}
          href={`/companies/${c.slug}`}
          className="surface surface-hover flex min-w-[168px] flex-1 flex-col justify-between rounded-xl px-4 py-3 transition-colors"
        >
          <div className="flex items-center gap-2">
            <CompanyLogo name={c.company} size={22} />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{c.company}</div>
              <div className="truncate text-xs text-ink-faint">{c.role}</div>
            </div>
          </div>
          <div className="mt-3">
            <div className="tnum text-lg font-semibold" style={{ color: "var(--accent)" }}>{origPay(c.amount, c.currency)}</div>
            <div className="mt-0.5 flex items-center justify-between text-[11px] text-ink-faint">
              <span className="truncate">{c.city}</span>
              <span className="tnum shrink-0 pl-2">{timeAgoShort(c.postedAt)}</span>
            </div>
          </div>
        </Link>
      ))}

      <Link
        href={viewAllHref}
        className="flex min-w-[92px] shrink-0 flex-col items-center justify-center rounded-xl px-3 text-center text-[11px] uppercase tracking-wider text-ink-muted transition-colors hover:text-[var(--accent)]"
      >
        View all →
      </Link>
    </div>
  );
}
