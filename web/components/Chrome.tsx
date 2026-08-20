import Link from "next/link";
import { getLastRefreshed, getFilterOptions, getCompaniesBoard, isConfigured } from "@/lib/data";
import { timeAgo } from "@/lib/format";
import { NavEnhancer } from "@/components/NavEnhancer";
import { SmartSearch } from "@/components/SmartSearch";
import { WATCHLIST } from "@/lib/watchlist";
import { slugify } from "@/lib/format";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`inline-flex items-center gap-2 font-semibold tracking-tight ${className}`}>
      <span
        className="logo-mark inline-block h-5 w-5 rounded-md"
        style={{ boxShadow: "0 0 14px -3px rgba(15,118,110,.5)" }}
      />
      <span className="text-[17px]">Trueline</span>
    </Link>
  );
}

const SALARIES = [
  { href: "/roles", label: "Roles" },
  { href: "/locations", label: "Cities" },
  { href: "/locations/countries", label: "Countries" },
];
const COMPANIES = [
  { href: "/companies", label: "Pay Index" },
  { href: "/compare", label: "Compare" },
];

const summaryCls =
  "flex cursor-pointer list-none items-center gap-1 rounded-lg px-3 py-2 text-ink-muted transition-colors hover:text-ink [&::-webkit-details-marker]:hidden";

// Dropdown built on <details> so it works without client JS (incl. mobile tap).
function Menu({ label, items }: { label: string; items: { href: string; label: string }[] }) {
  return (
    <details data-navmenu className="group relative">
      <summary className={summaryCls}>
        {label} <span className="text-[10px] transition-transform group-open:rotate-180">▾</span>
      </summary>
      <div className="surface absolute left-0 z-50 mt-1 w-44 rounded-xl border p-1 shadow-glow">
        {items.map((it) => (
          <Link key={it.href} href={it.href} className="block rounded-lg px-3 py-2 text-sm text-ink-muted transition-colors hover:bg-[var(--surface-3)] hover:text-ink">
            {it.label}
          </Link>
        ))}
      </div>
    </details>
  );
}

export async function NavBar() {
  // Data for the type-ahead nav search (all cached, shared across pages).
  let roles: string[] = [], cities: { label: string; n: number }[] = [], companies: { name: string; slug: string }[] = [];
  if (isConfigured) {
    const [opts, board] = await Promise.all([getFilterOptions(), getCompaniesBoard()]);
    roles = opts.roles; cities = opts.cities;
    const slugs = new Set(board.map((c) => c.slug));
    companies = [
      ...board.map((c) => ({ name: c.company, slug: c.slug })),
      ...WATCHLIST.filter((w) => !slugs.has(slugify(w.name))).map((w) => ({ name: w.name, slug: slugify(w.name) })),
    ];
  }
  const navSearch = <SmartSearch compact roles={roles} cities={cities} companies={companies} />;
  return (
    <header className="sticky top-0 z-40 border-b backdrop-blur-md" style={{ background: "rgba(255,255,255,.85)" }}>
      <NavEnhancer />
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-5">
        <div className="flex items-center gap-1">
          <Logo className="mr-2" />
          <nav className="hidden items-center gap-0.5 text-sm md:flex">
            <Menu label="Salaries" items={SALARIES} />
            <Menu label="Companies" items={COMPANIES} />
            <Link href="/leaderboards" className="rounded-lg px-3 py-2 text-ink-muted transition-colors hover:text-ink">Leaderboards</Link>
            <Link href="/compare" className="rounded-lg px-3 py-2 text-ink-muted transition-colors hover:text-ink">Compare</Link>
          </nav>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          {navSearch}
          <Link
            href="/add"
            className="rounded-lg border px-4 py-2 text-sm font-medium transition-colors"
            style={{ borderColor: "var(--accent)", color: "var(--accent)" }}
          >
            Add salary
          </Link>
        </div>

        {/* Mobile menu */}
        <details data-navmenu className="group relative md:hidden">
          <summary className="flex cursor-pointer list-none items-center rounded-lg px-2 py-2 text-ink-muted [&::-webkit-details-marker]:hidden">
            <span className="text-xl leading-none">≡</span>
          </summary>
          <div className="surface absolute right-0 z-50 mt-1 w-64 rounded-xl border p-3 shadow-glow">
            <div className="mb-3">{navSearch}</div>
            <div className="px-1 pb-1 text-[10px] text-ink-faint">Salaries</div>
            {SALARIES.map((it) => <MobileLink key={it.href} {...it} />)}
            <div className="px-1 pb-1 pt-2 text-[10px] text-ink-faint">Companies</div>
            {COMPANIES.map((it) => <MobileLink key={it.href} {...it} />)}
            <div className="mt-2 border-t pt-2" style={{ borderColor: "var(--border)" }}>
              <MobileLink href="/leaderboards" label="Leaderboards" />
              <MobileLink href="/methodology" label="Methodology" />
            </div>
            <Link href="/add" className="btn-primary mt-3 block rounded-lg px-4 py-2 text-center text-sm font-semibold">Add salary</Link>
          </div>
        </details>
      </div>
    </header>
  );
}

function MobileLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="block rounded-lg px-3 py-2 text-sm text-ink-muted transition-colors hover:bg-[var(--surface-3)] hover:text-ink">
      {label}
    </Link>
  );
}

const FOOTER_COLS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Explore",
    links: [
      { href: "/roles", label: "Salaries by role" },
      { href: "/locations", label: "Salaries by city" },
      { href: "/locations/countries", label: "Salaries by country" },
      { href: "/leaderboards", label: "Leaderboards" },
    ],
  },
  {
    title: "Companies",
    links: [
      { href: "/companies", label: "The Pay Index" },
      { href: "/compare", label: "Compare companies" },
      { href: "/leaderboards#transparent", label: "Most transparent" },
      { href: "/for-companies", label: "For companies" },
    ],
  },
  {
    title: "Trust",
    links: [
      { href: "/methodology", label: "Methodology" },
      { href: "/add", label: "Add your salary" },
      { href: "/methodology#sample-gates", label: "Sample gates" },
      { href: "/methodology#who-pays", label: "How Pay Score works" },
    ],
  },
];

export async function Footer() {
  const refreshed = await getLastRefreshed();
  return (
    <footer className="mt-24 border-t" style={{ borderColor: "var(--border)" }}>
      <div className="mx-auto max-w-6xl px-5 py-12">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-3 max-w-xs text-sm text-ink-muted">
              Real base salaries from live job postings across Europe, the Middle East and Africa. Honest samples, no invented numbers.
            </p>
          </div>
          {FOOTER_COLS.map((col) => (
            <div key={col.title}>
              <div className="text-[10px] text-ink-faint">{col.title}</div>
              <ul className="mt-3 space-y-2 text-sm">
                {col.links.map((l) => (
                  <li key={l.href}><Link href={l.href} className="text-ink-muted transition-colors hover:text-ink">{l.label}</Link></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-col gap-2 border-t pt-6 text-xs text-ink-faint md:flex-row md:items-center md:justify-between" style={{ borderColor: "var(--border)" }}>
          <span>Advertised base salaries from public job postings. Approximate EUR.</span>
          <span className="tnum">Data refreshed {timeAgo(refreshed)}</span>
        </div>
      </div>
    </footer>
  );
}
