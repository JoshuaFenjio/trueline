"use client";
import { useEffect, useMemo, useRef, useState } from "react";

// One shared type-ahead combobox: type to get ranked suggestions (prefix matches
// first, then substring), full keyboard nav, click-outside close. Controlled by
// `value`/`onChange`. Empty value = the "all" state shown via `placeholder`; a
// clear row (placeholder text) is always offered so it doubles as a dropdown.
export function Combobox({
  options, value, onChange, placeholder, clearValue = "", className = "", inputClassName = "field w-full px-3 py-2 text-sm",
}: {
  options: string[]; value: string; onChange: (v: string) => void; placeholder: string;
  clearValue?: string; className?: string; inputClassName?: string;
}) {
  const [input, setInput] = useState(value === clearValue ? "" : value);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { setInput(value === clearValue ? "" : value); }, [value, clearValue]);

  const rows = useMemo(() => {
    const s = input.trim().toLowerCase();
    let opts = options;
    if (s) {
      opts = options
        .filter((o) => o.toLowerCase().includes(s))
        .sort((a, b) => {
          const ap = a.toLowerCase().startsWith(s) ? 0 : 1;
          const bp = b.toLowerCase().startsWith(s) ? 0 : 1;
          return ap - bp || a.localeCompare(b);
        });
    }
    const out = [{ label: placeholder, v: clearValue, clear: true }, ...opts.slice(0, 30).map((o) => ({ label: o, v: o, clear: false }))];
    return out;
  }, [input, options, placeholder, clearValue]);

  function commit(v: string) { onChange(v); setInput(v === clearValue ? "" : v); setOpen(false); }
  function onKey(e: React.KeyboardEvent) {
    if (!open) { if (e.key === "ArrowDown") { setOpen(true); setActive(0); } return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, rows.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (rows[active]) commit(rows[active].v); }
    else if (e.key === "Escape") { setOpen(false); setInput(value === clearValue ? "" : value); }
  }

  return (
    <div ref={ref} className={`relative ${className}`}>
      <input
        value={input}
        onChange={(e) => { setInput(e.target.value); setOpen(true); setActive(0); }}
        onKeyDown={onKey}
        onFocus={() => { setOpen(true); setActive(0); }}
        onBlur={() => setTimeout(() => { setOpen(false); setInput(value === clearValue ? "" : value); }, 150)}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        className={inputClassName}
      />
      {open && rows.length > 0 && (
        <ul className="surface absolute z-40 mt-1.5 max-h-72 w-full overflow-auto rounded-xl border p-1 shadow-glow" role="listbox">
          {rows.map((r, i) => (
            <li key={r.v + i} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); commit(r.v); }}
                onMouseEnter={() => setActive(i)}
                className={`flex w-full items-center rounded-lg px-3 py-2 text-left text-sm ${i === active ? "bg-[var(--surface-3)]" : ""} ${r.clear ? "text-ink-muted" : ""}`}
              >
                {r.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
