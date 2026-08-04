import Link from "next/link";
import { getLastRefreshed } from "@/lib/data";
import { timeAgo } from "@/lib/format";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`inline-flex items-center gap-2 font-semibold tracking-tight ${className}`}>
      <span
        className="inline-block h-5 w-5 rounded-md gradient-bg"
        style={{ boxShadow: "0 0 16px -2px rgba(124,108,255,.7)" }}
      />
      <span className="text-[17px]">Trueline</span>
    </Link>
  );
}

const links = [
  { href: "/leaderboards", label: "Leaderboards" },
  { href: "/companies", label: "Companies" },
  { href: "/compare", label: "Compare" },
  { href: "/add", label: "Add salary" },
];

export function NavBar() {
  return (
    <header className="sticky top-0 z-40 border-b backdrop-blur-md" style={{ background: "rgba(7,8,11,.72)" }}>
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
        <Logo />
        <nav className="flex items-center gap-1 text-sm">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-2 text-ink-muted transition-colors hover:text-ink"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

export async function Footer() {
  const refreshed = await getLastRefreshed();
  return (
    <footer className="mt-20 border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-10 text-sm text-ink-faint md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <Logo />
          <span className="ml-2">Know what Europe actually pays.</span>
        </div>
        <div className="flex flex-wrap gap-4">
          <Link href="/companies" className="hover:text-ink">Companies</Link>
          <Link href="/compare" className="hover:text-ink">Compare</Link>
          <Link href="/add" className="hover:text-ink">Add salary</Link>
          <Link href="/for-companies" className="hover:text-ink">For companies</Link>
          <Link href="/methodology" className="hover:text-ink">Methodology</Link>
        </div>
        <div className="flex flex-col gap-1 text-xs md:items-end">
          <span className="tnum text-[11px] text-ink-faint">Data refreshed {timeAgo(refreshed)}</span>
          <span>Advertised base salaries from public job postings. Approximate EUR.</span>
        </div>
      </div>
    </footer>
  );
}
