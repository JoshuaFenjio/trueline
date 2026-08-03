"use client";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { parseQuery, parsedHref } from "@/lib/parseQuery";
import { slugify } from "@/lib/format";

interface Props {
  roles: string[];
  cities: { label: string; n: number }[];
  companies: { name: string; slug: string }[];
}
type Sug = { kind: "role" | "city" | "company"; label: string; href: string };

export function SmartSearch({ roles, cities, companies }: Props) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);

  const suggestions = useMemo<Sug[]>(() => {
    const s = q.toLowerCase().trim();
    if (s.length < 2) return [];
    const out: Sug[] = [];
    for (const c of companies) {
      if (c.name.toLowerCase().includes(s)) out.push({ kind: "company", label: c.name, href: `/companies/${c.slug}` });
      if (out.filter((x) => x.kind === "company").length >= 3) break;
    }
    for (const c of cities) {
      if (c.label.toLowerCase().includes(s.split(" ").pop() || s)) out.push({ kind: "city", label: c.label, href: `/locations/${slugify(c.label)}` });
      if (out.filter((x) => x.kind === "city").length >= 3) break;
    }
    for (const r of roles) {
      if (r.toLowerCase().includes(s)) out.push({ kind: "role", label: r, href: `/roles/${slugify(r)}` });
      if (out.filter((x) => x.kind === "role").length >= 3) break;
    }
    return out.slice(0, 8);
  }, [q, roles, cities, companies]);

  function submit(query: string) {
    const parsed = parseQuery(query, { roles, cities, companies });
    router.push(parsedHref(parsed));
    setOpen(false);
  }

  function onKey(e: React.KeyboardEvent) {
    if (!open || suggestions.length === 0) {
      if (e.key === "Enter") submit(q);
      return;
    }
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, suggestions.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, -1)); }
    else if (e.key === "Enter") {
      e.preventDefault();
      if (active >= 0) router.push(suggestions[active].href);
      else submit(q);
      setOpen(false);
    } else if (e.key === "Escape") setOpen(false);
  }

  return (
    <div ref={boxRef} className="relative">
      <div className="surface flex items-center gap-2 rounded-2xl p-2 pl-4" style={{ borderColor: "var(--border-strong)" }}>
        <span className="text-ink-faint">⌕</span>
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(-1); }}
          onKeyDown={onKey}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Try “software engineer berlin”, “sales london”, “ml zurich”…"
          className="w-full bg-transparent py-2.5 text-base outline-none placeholder:text-ink-faint"
          aria-label="Search roles, cities, or companies"
        />
        <button onClick={() => submit(q)} className="btn-primary shrink-0 rounded-xl px-5 py-2.5 text-sm">
          Search
        </button>
      </div>

      {open && suggestions.length > 0 && (
        <div className="surface absolute z-30 mt-2 w-full overflow-hidden rounded-xl border p-1 shadow-glow">
          {suggestions.map((s, i) => (
            <button
              key={s.kind + s.label}
              onMouseDown={(e) => { e.preventDefault(); router.push(s.href); setOpen(false); }}
              onMouseEnter={() => setActive(i)}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${i === active ? "bg-[var(--surface-3)]" : ""}`}
            >
              <span>{s.label}</span>
              <span className="tnum text-[10px] uppercase tracking-wider text-ink-faint">{s.kind}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
