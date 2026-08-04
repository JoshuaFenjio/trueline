"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

interface Co { name: string; slug: string }

export function CompareBuilder({ all, selected }: { all: Co[]; selected: string[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const chosen = selected.map((s) => all.find((a) => a.slug === s)).filter(Boolean) as Co[];

  function go(slugs: string[]) {
    const uniq = Array.from(new Set(slugs)).slice(0, 3);
    router.push(uniq.length ? `/compare?companies=${uniq.join(",")}` : "/compare");
  }
  const add = (slug: string) => { setQ(""); go([...selected, slug]); };
  const remove = (slug: string) => go(selected.filter((s) => s !== slug));

  const matches = useMemo(() => {
    const s = q.toLowerCase().trim();
    if (!s) return [];
    return all.filter((a) => a.name.toLowerCase().includes(s) && !selected.includes(a.slug)).slice(0, 6);
  }, [q, all, selected]);

  return (
    <div className="surface rounded-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        {chosen.map((c) => (
          <span key={c.slug} className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm" style={{ background: "var(--surface-2)" }}>
            {c.name}
            <button onClick={() => remove(c.slug)} aria-label={`Remove ${c.name}`} className="text-ink-faint hover:text-ink">×</button>
          </span>
        ))}
        {selected.length < 3 && (
          <div className="relative">
            <input
              value={q} onChange={(e) => setQ(e.target.value)}
              placeholder={selected.length ? "Add another…" : "Add a company…"}
              className="field px-3 py-1.5 text-sm"
            />
            {matches.length > 0 && (
              <div className="surface absolute z-20 mt-1 w-56 overflow-hidden rounded-lg border p-1 shadow-glow">
                {matches.map((m) => (
                  <button key={m.slug} onMouseDown={(e) => { e.preventDefault(); add(m.slug); }} className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-[var(--surface-3)]">
                    {m.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      {selected.length < 2 && (
        <p className="mt-3 text-xs text-ink-faint">Pick 2–3 companies to compare.</p>
      )}
    </div>
  );
}
