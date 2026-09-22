import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { roleFromSlug, getRolePostingsAll } from "@/lib/data";
import { Breadcrumbs } from "@/components/blocks";
import { PostingList } from "@/components/PostingList";
import { Icon } from "@/components/icons";
import { familyLabel } from "@/lib/roleNames";
import { LEVELS, isManagementLevel, type Level } from "@/lib/levels";
import { sortPostings, type PostingSort } from "@/lib/postings";
import { slugify } from "@/lib/format";

// Filterable list of live ads. Deliberately noindex: it is a filtered view of
// job ads that belong to the boards and companies that published them — we link
// out to every one, and we don't want search engines treating our filtered
// slices as the canonical copy.
export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;

export async function generateMetadata({ params }: { params: { role: string } }): Promise<Metadata> {
  const role = await roleFromSlug(params.role);
  if (!role) return { title: "Role not found", robots: { index: false } };
  return { title: `Live ${familyLabel(role)} job ads`, robots: { index: false, follow: true } };
}

export default async function RolePostingsPage({
  params, searchParams,
}: {
  params: { role: string };
  searchParams: { country?: string; level?: string; pay?: string; sort?: string; page?: string };
}) {
  const role = await roleFromSlug(params.role);
  if (!role) notFound();
  const label = familyLabel(role);
  const all = await getRolePostingsAll(role);

  const country = (searchParams.country || "").trim();
  const level = (searchParams.level || "").trim();
  const payOnly = searchParams.pay === "1";
  const sort: PostingSort = searchParams.sort === "pay" ? "pay" : "new";
  const page = Math.max(1, Number(searchParams.page) || 1);

  // Filter options come from the data itself, so a filter can never offer a
  // combination that returns nothing.
  const countries = [...new Set(all.map((p) => p.country).filter(Boolean) as string[])].sort();
  const levelsPresent = LEVELS.filter((l) => all.some((p) => p.levelExplicit && p.level === l));

  const filtered = all.filter((p) =>
    (!country || p.country === country) &&
    (!level || (p.levelExplicit && p.level === level)) &&
    (!payOnly || p.midpoint != null)
  );
  const sorted = sortPostings(filtered, sort);
  const rows = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));

  const qs = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { country, level, pay: payOnly ? "1" : "", sort: sort === "pay" ? "pay" : "", ...over };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return `/roles/${slugify(role)}/postings${s ? `?${s}` : ""}`;
  };

  const disclosed = filtered.filter((p) => p.midpoint != null).length;

  return (
    <div className="pb-8">
      <div className="pt-8">
        <Breadcrumbs items={[
          { label: "Salaries", href: "/roles" },
          { label, href: `/roles/${slugify(role)}` },
          { label: "Live job ads" },
        ]} />
      </div>

      <header className="mt-6">
        <span className="eyebrow-pill"><span className="eyebrow">{all.length.toLocaleString()} live job ads tracked</span></span>
        <h1 className="t-h2 mt-4">Live <span className="accent-italic">{label}</span> job ads</h1>
        <p className="mt-3 max-w-2xl text-ink-muted">
          Every {label} ad we currently track across EMEA. Pay is shown only where the ad disclosed it —{" "}
          <span className="tnum text-ink">{disclosed.toLocaleString()}</span> of{" "}
          <span className="tnum text-ink">{filtered.length.toLocaleString()}</span> in this view. Titles link to the
          employer&rsquo;s own posting.
        </p>
      </header>

      {/* Filters — plain links, so every view is server-rendered and shareable. */}
      <form method="get" className="mt-6 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1.5 block text-xs text-ink-muted">Country</span>
          <select name="country" defaultValue={country} className="field px-3 py-2.5 text-sm">
            <option value="">All countries</option>
            {countries.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs text-ink-muted">Seniority</span>
          <select name="level" defaultValue={level} className="field px-3 py-2.5 text-sm">
            <option value="">Any seniority</option>
            {levelsPresent.map((l) => (
              <option key={l} value={l}>{isManagementLevel(l as Level) ? `${l} (management)` : l}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs text-ink-muted">Sort</span>
          <select name="sort" defaultValue={sort} className="field px-3 py-2.5 text-sm">
            <option value="new">Newest first</option>
            <option value="pay">Highest paying first</option>
          </select>
        </label>
        <label className="flex items-center gap-2 pb-3 text-sm text-ink-muted">
          <input type="checkbox" name="pay" value="1" defaultChecked={payOnly} />
          Only ads that disclose pay
        </label>
        <button type="submit" className="btn-primary mb-1 rounded-lg px-4 py-2.5 text-sm font-semibold">Apply</button>
        {(country || level || payOnly || sort === "pay") && (
          <Link href={qs({ country: "", level: "", pay: "", sort: "" })} className="mb-3 text-sm text-ink-muted hover:text-ink">Reset</Link>
        )}
      </form>

      <section className="mt-6 card !p-0">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3 text-[12px] text-ink-faint" style={{ borderColor: "var(--border)" }}>
          <span className="tnum">
            {sorted.length.toLocaleString()} ad{sorted.length === 1 ? "" : "s"}
            {country ? ` in ${country}` : ""}{level ? ` · ${level}` : ""}
          </span>
          <span>{sort === "pay" ? "Highest paying first" : "Newest first"}</span>
        </div>
        <div className="px-4 py-2">
          <PostingList postings={rows} emptyNote="No live ads match these filters right now." />
        </div>
        {pages > 1 && (
          <div className="flex items-center justify-between gap-3 border-t px-4 py-3 text-sm" style={{ borderColor: "var(--border)" }}>
            {page > 1
              ? <Link href={qs({ page: String(page - 1) })} className="arrow-link inline-flex items-center gap-1 text-xs"><span className="arw">←</span><span>Previous</span></Link>
              : <span />}
            <span className="tnum text-[12px] text-ink-faint">Page {page} of {pages}</span>
            {page < pages
              ? <Link href={qs({ page: String(page + 1) })} className="arrow-link inline-flex items-center gap-1 text-xs"><span>Next</span><span className="arw">→</span></Link>
              : <span />}
          </div>
        )}
      </section>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link href={`/roles/${slugify(role)}`} className="pill-btn">
          <Icon.bars size={14} /><span>{label} benchmarks</span><span className="arw">→</span>
        </Link>
      </div>
    </div>
  );
}
