import Link from "next/link";
import { getLastRefreshed, getFilterOptions, getCompaniesBoard, isConfigured } from "@/lib/data";
import { timeAgo } from "@/lib/format";
import { NavEnhancer } from "@/components/NavEnhancer";
import { SmartSearch } from "@/components/SmartSearch";
import { EmailCapture } from "@/components/EmailCapture";
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
      <div className="container-page flex h-16 items-center justify-between gap-4">
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
    title: "Product",
    links: [
      { href: "/companies", label: "The Pay Index" },
      { href: "/compare", label: "Compare companies" },
      { href: "/leaderboards", label: "Leaderboards" },
      { href: "/locations/countries", label: "Europe pay map" },
    ],
  },
  {
    title: "For job seekers",
    links: [
      { href: "/roles", label: "Salaries by role" },
      { href: "/locations", label: "Salaries by city" },
      { href: "/locations/countries", label: "Salaries by country" },
      { href: "/add", label: "Add your salary" },
    ],
  },
  {
    title: "For employers",
    links: [
      { href: "/for-companies", label: "Benchmark offers" },
      { href: "/leaderboards#transparent", label: "Most transparent" },
      { href: "/companies", label: "Browse companies" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/methodology", label: "Methodology" },
      { href: "/methodology#who-pays", label: "How Pay Score works" },
      { href: "/methodology#sample-gates", label: "Sample gates" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/methodology", label: "Data & sources" },
      { href: "/methodology#sample-gates", label: "Accuracy & gates" },
      { href: "mailto:hello@trueline.eu", label: "Contact" },
    ],
  },
];

function Social({ label, href, children }: { label: string; href: string; children: React.ReactNode }) {
  return (
    <a href={href} aria-label={label} className="flex h-8 w-8 items-center justify-center rounded-lg border text-ink-muted transition-colors hover:border-[var(--border-strong)] hover:text-ink" style={{ borderColor: "var(--border)" }}>
      {children}
    </a>
  );
}

export async function Footer() {
  const refreshed = await getLastRefreshed();
  const year = new Date().getUTCFullYear();
  return (
    <footer className="mt-24 border-t" style={{ borderColor: "var(--border)" }}>
      <div className="container-page py-14">
        <div className="grid gap-10 lg:grid-cols-[1.5fr_repeat(5,1fr)]">
          <div>
            <Logo />
            <p className="mt-3 max-w-xs text-sm text-ink-muted">
              Real base salaries from live job postings across Europe, the Middle East and Africa. Honest samples, no invented numbers.
            </p>
            <div className="mt-4 flex gap-2">
              <Social label="Trueline on X" href="#">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.9 2H22l-7.1 8.1L23 22h-6.5l-5-6.6L5.7 22H2.5l7.6-8.7L2 2h6.7l4.5 6 5.7-6Zm-1.1 18h1.8L7.3 3.8H5.4L17.8 20Z" /></svg>
              </Social>
              <Social label="Trueline on LinkedIn" href="#">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4.98 3.5A2.5 2.5 0 1 0 5 8.5a2.5 2.5 0 0 0 0-5ZM3 9h4v12H3zM9 9h3.8v1.7h.05c.53-1 1.83-2.05 3.76-2.05C20.3 8.65 21 11 21 14.1V21h-4v-6c0-1.43-.03-3.27-2-3.27-2 0-2.3 1.56-2.3 3.17V21H9z" /></svg>
              </Social>
              <Social label="Trueline on GitHub" href="#">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.15-1.11-1.46-1.11-1.46-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.53 2.36 1.09 2.94.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02a9.5 9.5 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" /></svg>
              </Social>
            </div>
          </div>
          {FOOTER_COLS.map((col) => (
            <div key={col.title}>
              <div className="text-[11px] font-medium text-ink">{col.title}</div>
              <ul className="mt-3 space-y-2 text-[13px]">
                {col.links.map((l) => (
                  <li key={l.href}><Link href={l.href} className="text-ink-muted transition-colors hover:text-ink">{l.label}</Link></li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Newsletter card */}
        <div className="card mt-12 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[15px] font-semibold">Get the monthly EMEA pay brief</div>
            <div className="mt-1 text-sm text-ink-muted">What moved, which roles heated up, where pay is rising. One email a month, no spam.</div>
          </div>
          <div className="w-full md:w-96"><EmailCapture source="newsletter" cta="Subscribe" placeholder="you@email.com" /></div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t pt-6 text-xs text-ink-faint md:flex-row md:items-center md:justify-between" style={{ borderColor: "var(--border)" }}>
          <span>© {year} Trueline · Advertised base salaries from public job postings. Approximate EUR. <span className="tnum">Refreshed {timeAgo(refreshed)}</span></span>
          <label className="flex items-center gap-2">
            <span className="sr-only">Language</span>
            <select className="filter-pill py-1.5 text-xs" defaultValue="en" aria-label="Language">
              <option value="en">English</option>
              <option value="de">Deutsch</option>
              <option value="fr">Français</option>
            </select>
          </label>
        </div>
      </div>
    </footer>
  );
}
