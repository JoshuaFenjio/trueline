"use client";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { parseQuery, parsedHref } from "@/lib/parseQuery";
import { Combobox } from "@/components/Combobox";
import { slugify } from "@/lib/format";

interface Props {
  roles: string[];
  cities: { label: string; n: number }[];
  companies: { name: string; slug: string }[];
  countries?: string[];
  compact?: boolean; // nav variant: single input, no location select
}
type Sug = { kind: "role" | "company" | "city"; label: string; href?: string; role?: string };

export function SmartSearch({ roles, cities, companies, countries = [], compact = false }: Props) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [location, setLocation] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);
  const locationOptions = useMemo(() => [...cities.map((c) => c.label), ...countries], [cities, countries]);

  // Type-ahead: companies first (jump straight to the page), then roles. The
  // compact nav variant also suggests cities since it has no location select.
  const suggestions = useMemo<Sug[]>(() => {
    const s = q.toLowerCase().trim();
    if (s.length < 2) return [];
    const out: Sug[] = [];
    for (const c of companies) {
      if (c.name.toLowerCase().includes(s)) out.push({ kind: "company", label: c.name, href: `/companies/${c.slug}` });
      if (out.filter((x) => x.kind === "company").length >= 4) break;
    }
    for (const r of roles) {
      if (r.toLowerCase().includes(s)) out.push({ kind: "role", label: r, role: r });
      if (out.filter((x) => x.kind === "role").length >= 4) break;
    }
    if (compact) {
      for (const c of cities) {
        if (c.label.toLowerCase().includes(s.split(" ").pop() || s)) out.push({ kind: "city", label: c.label, href: `/locations/${slugify(c.label)}` });
        if (out.filter((x) => x.kind === "city").length >= 3) break;
      }
    }
    return out.slice(0, 8);
  }, [q, roles, cities, companies, compact]);

  function goRoleLocation(role: string) {
    const params = new URLSearchParams();
    if (role) params.set("role", role);
    if (location) params.set("city", location);
    const qs = params.toString();
    router.push(qs ? `/?${qs}#results` : "/#results");
    setOpen(false);
  }

  function submit() {
    const parsed = parseQuery(q, { roles, cities: compact ? cities : [], companies });
    if (compact) { router.push(parsedHref(parsed)); setOpen(false); return; }
    if (parsed.companySlug) { router.push(`/companies/${parsed.companySlug}`); setOpen(false); return; }
    goRoleLocation(parsed.role || (roles.includes(q.trim()) ? q.trim() : ""));
  }

  function pick(s: Sug) {
    if (s.href) { router.push(s.href); setOpen(false); return; }
    if (s.role) { setQ(s.role); goRoleLocation(s.role); }
  }

  function onKey(e: React.KeyboardEvent) {
    if (open && suggestions.length) {
      if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, suggestions.length - 1)); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, -1)); return; }
      if (e.key === "Enter") { e.preventDefault(); active >= 0 ? pick(suggestions[active]) : submit(); return; }
      if (e.key === "Escape") { setOpen(false); return; }
    } else if (e.key === "Enter") submit();
  }

  const dropdown = open && suggestions.length > 0 && (
    <div className="surface absolute z-30 mt-2 w-full overflow-hidden rounded-xl border p-1 shadow-glow">
      {suggestions.map((s, i) => (
        <button
          key={s.kind + s.label}
          onMouseDown={(e) => { e.preventDefault(); pick(s); }}
          onMouseEnter={() => setActive(i)}
          className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${i === active ? "bg-[var(--surface-3)]" : ""}`}
        >
          <span>{s.label}</span>
 <span className="text-[10px] text-ink-faint">{s.kind}</span>
        </button>
      ))}
    </div>
  );

  if (compact) {
    return (
      <div ref={boxRef} className="relative">
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(-1); }}
          onKeyDown={onKey}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search role, city, company…"
          className="field w-full rounded-lg px-3 py-2 text-sm md:w-52"
          aria-label="Search roles, cities, or companies"
        />
        {dropdown}
      </div>
    );
  }

  return (
    <div ref={boxRef} className="relative">
      {/* One instrument: bare role input | hairline | bare location | button.
          Below sm there isn't room for all three on a line without clipping the
          role placeholder, so it stacks: role on top, location + button under. */}
      <div
        className="surface flex flex-col gap-2 rounded-xl p-2 sm:flex-row sm:items-center sm:gap-0 sm:p-1.5 sm:pl-4"
        style={{ borderColor: "var(--border-strong)" }}
      >
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(-1); }}
          onKeyDown={onKey}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search a role or company…"
          className="w-full min-w-0 bg-transparent px-2 py-2.5 text-[15px] outline-none placeholder:text-ink-faint sm:flex-1 sm:px-0"
          aria-label="Search roles or companies"
        />
        <span className="mx-1 hidden h-7 w-px shrink-0 sm:block" style={{ background: "var(--border)" }} />
        {/* sm:contents dissolves this row back into the bar's flex line. */}
        <div className="flex items-center gap-2 sm:contents">
          {/* Same size and family as the role input so the two segments read as
              one instrument; 8.5rem fits "All locations" and leaves the role
              placeholder room to render in full at the hero's 45% column. */}
          <Combobox
            options={locationOptions}
            value={location}
            onChange={setLocation}
            placeholder="All locations"
            className="min-w-0 flex-1 sm:w-[8.5rem] sm:flex-none sm:shrink-0"
            inputClassName="w-full border-0 bg-transparent py-2.5 pl-2 pr-1 text-[15px] text-ink-muted outline-none placeholder:text-ink-faint"
          />
          <button onClick={submit} className="btn-primary shrink-0 rounded-lg px-5 py-2.5 text-sm font-semibold sm:ml-1.5">Search</button>
        </div>
      </div>
      {dropdown}
    </div>
  );
}
