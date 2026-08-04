import { LEVELS } from "@/lib/levels";
import { PrimaryButton } from "./ui";

interface Props {
  roles: string[];
  cities: { key: string; label: string; n: number }[];
  current: { role?: string; level?: string; city?: string; base?: string };
  compact?: boolean;
}

export function SearchForm({ roles, cities, current, compact }: Props) {
  return (
    <form method="get" action="/#results" className="surface rounded-card p-4 md:p-5">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-12 md:items-end">
        <Field label="Role" className="md:col-span-3">
          <select name="role" defaultValue={current.role || "Any"} className="field w-full px-3 py-3">
            <option value="Any">Any role</option>
            {roles.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </Field>

        <Field label="Level" className="md:col-span-2">
          <select name="level" defaultValue={current.level || "Any"} className="field w-full px-3 py-3">
            <option value="Any">Any level</option>
            {LEVELS.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </Field>

        <Field label="City" className="md:col-span-3">
          <select name="city" defaultValue={current.city || "Any"} className="field w-full px-3 py-3">
            <option value="Any">Any city</option>
            {cities.map((c) => (
              <option key={c.key} value={c.key}>{c.label} · {c.n}</option>
            ))}
          </select>
        </Field>

        <Field label="Your base (optional)" className="md:col-span-2">
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint">€</span>
            <input
              name="base" type="number" inputMode="numeric" min={0} step={1000}
              defaultValue={current.base || ""} placeholder="75000"
              className="field tnum w-full py-3 pl-7 pr-3"
            />
          </div>
        </Field>

        <div className="md:col-span-2">
          <PrimaryButton className="w-full">See the numbers</PrimaryButton>
        </div>
      </div>
      {!compact && (
        <p className="mt-3 text-xs text-ink-faint">
          Real advertised base salaries. If a query has fewer than 8 recent postings, we say so. We never invent a number.
        </p>
      )}
    </form>
  );
}

function Field({ label, className = "", children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-xs text-ink-muted">{label}</span>
      {children}
    </label>
  );
}
