"use client";
import { useEffect, useMemo, useRef, useState } from "react";

// One shared type-ahead combobox: type to get ranked suggestions (prefix matches
// first, then substring), full keyboard nav, click-outside close. Controlled by
// `value`/`onChange`. Empty value = the "all" state shown via `placeholder`; a
// clear row (placeholder text) is always offered so it doubles as a dropdown.
export function Combobox({
  options, value, onChange, placeholder, clearValue = "", className = "", inputClassName = "field w-full px-3 py-2 text-sm",
  labelOf, optionLabelOf, allowFreeText = false,
}: {
  options: string[]; value: string; onChange: (v: string) => void; placeholder: string;
  clearValue?: string; className?: string; inputClassName?: string;
  // Display-only mapping. The committed value is ALWAYS the canonical option
  // string (a role_family key, a country name…), so URLs and data lookups are
  // untouched; only what the user reads changes. `optionLabelOf` lets the
  // dropdown rows say more than the selected input does — e.g. a group family
  // renders as "Operations — role family" in the list but "Operations" once
  // chosen.
  labelOf?: (v: string) => string;
  optionLabelOf?: (v: string) => string;
  // Submission forms need to accept a company or city we don't track yet, so
  // typed text that matches no option is committed verbatim instead of being
  // discarded on blur. Filter/picker uses leave this off: there, a value that
  // isn't an option would filter to nothing.
  allowFreeText?: boolean;
}) {
  const label = labelOf ?? ((v: string) => v);
  const rowLabel = optionLabelOf ?? label;
  const [input, setInput] = useState(value === clearValue ? "" : label(value));
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  // The blur fix-up runs on a 150ms timer (so a mousedown on a row lands
  // first). Reading `input` from the render closure there is stale, and would
  // let a just-clicked option be overwritten by whatever was typed before it —
  // so the latest input and a "we already committed" flag live in refs.
  const inputRef = useRef(input);
  inputRef.current = input;
  const committedRef = useRef(false);
  useEffect(() => { setInput(value === clearValue ? "" : label(value)); }, [value, clearValue, labelOf]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo(() => {
    const s = input.trim().toLowerCase();
    let opts = options;
    if (s) {
      // Match the canonical value AND the display label, so typing "backend
      // engineer" finds the family stored as "Backend".
      const hay = (o: string) => `${o} ${rowLabel(o)}`.toLowerCase();
      opts = options
        .filter((o) => hay(o).includes(s))
        .sort((a, b) => {
          const ap = rowLabel(a).toLowerCase().startsWith(s) || a.toLowerCase().startsWith(s) ? 0 : 1;
          const bp = rowLabel(b).toLowerCase().startsWith(s) || b.toLowerCase().startsWith(s) ? 0 : 1;
          return ap - bp || rowLabel(a).localeCompare(rowLabel(b));
        });
    }
    const rowsOut = opts.slice(0, 30).map((o) => ({ label: rowLabel(o), v: o, clear: false }));
    // The clear row doubles as "show everything" for filter comboboxes. On a
    // free-text field it is only useful once there is something to clear.
    const showClear = !allowFreeText || value !== clearValue;
    return showClear ? [{ label: placeholder, v: clearValue, clear: true }, ...rowsOut] : rowsOut;
  }, [input, options, placeholder, clearValue, optionLabelOf, labelOf, allowFreeText, value]); // eslint-disable-line react-hooks/exhaustive-deps

  function commit(v: string) {
    committedRef.current = true;
    onChange(v);
    const next = v === clearValue ? "" : label(v);
    setInput(next); inputRef.current = next;
    setOpen(false);
  }
  // Free text: keep exactly what was typed, as both value and display.
  function commitFree(v: string) {
    committedRef.current = true;
    onChange(v); setInput(v); inputRef.current = v; setOpen(false);
  }
  function onKey(e: React.KeyboardEvent) {
    if (!open) { if (e.key === "ArrowDown") { setOpen(true); setActive(0); } return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, rows.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") {
      e.preventDefault();
      // A highlighted real option always wins over free text — otherwise
      // arrow-down + Enter silently stored the half-typed string instead of
      // the option the user was looking at.
      const row = rows[active];
      if (row && !row.clear) commit(row.v);
      else if (allowFreeText && input.trim()) commitFree(input.trim());
      else if (row) commit(row.v);
    }
    else if (e.key === "Escape") { setOpen(false); setInput(value === clearValue ? "" : label(value)); }
  }

  return (
    <div ref={ref} className={`relative ${className}`}>
      <input
        value={input}
        onChange={(e) => { setInput(e.target.value); setOpen(true); setActive(allowFreeText ? 0 : 0); }}
        onKeyDown={onKey}
        onFocus={() => { setOpen(true); setActive(0); }}
        onBlur={() => {
          committedRef.current = false;
          setTimeout(() => {
            setOpen(false);
            if (committedRef.current) return; // a row was picked; leave it alone
            const t = inputRef.current.trim();
            if (allowFreeText && t && t !== label(value)) { onChange(t); return; }
            setInput(value === clearValue ? "" : label(value));
          }, 150);
        }}
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
