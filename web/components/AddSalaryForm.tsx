"use client";
import { useState } from "react";
import { Combobox } from "@/components/Combobox";
import { PrimaryButton } from "@/components/ui";
import { Icon } from "@/components/icons";
import { familySuggestLabel, familyLabel } from "@/lib/roleNames";
import { LEVELS, isManagementLevel, type Level } from "@/lib/levels";

export interface AddOptions {
  roles: string[];
  cities: string[];
  countries: string[];
  companies: string[];
}

/**
 * The submission form.
 *
 * Every entity field is a type-ahead over what we ACTUALLY track, so a
 * submission lands on the same role family / city / company the benchmarks use
 * instead of a near-miss spelling — while still accepting free text for
 * anything new. The exact job title is captured separately and raw: it is what
 * classification reads, and it is the field most likely to teach us a role we
 * don't label yet.
 *
 * Bonus, equity and comments are optional and clearly marked as context. They
 * are stored on the submission and shown to the reviewer; they never enter a
 * base-salary median.
 */
export function AddSalaryForm({
  action, options, defaultCompany = "",
}: {
  action: (fd: FormData) => void;
  options: AddOptions;
  defaultCompany?: string;
}) {
  const [role, setRole] = useState("");
  const [level, setLevel] = useState("");
  const [company, setCompany] = useState(defaultCompany);
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [showContext, setShowContext] = useState(false);

  return (
    <form action={action} className="space-y-4">
      {/* Committed values ride along as hidden inputs — the comboboxes are
          controlled, and a free-typed value is kept verbatim. */}
      <input type="hidden" name="role_family" value={role} />
      <input type="hidden" name="level" value={level} />
      <input type="hidden" name="company" value={company} />
      <input type="hidden" name="city" value={city} />
      <input type="hidden" name="country" value={country} />

      <Row>
        <Field label="Role family *" hint="Pick the closest — we'll refine it from your exact title.">
          <Combobox
            options={options.roles}
            value={role}
            onChange={setRole}
            labelOf={familyLabel}
            optionLabelOf={familySuggestLabel}
            placeholder="Search role families…"
            inputClassName="field w-full px-3 py-3"
            allowFreeText
          />
        </Field>
        <Field label="Level" hint="Only if your title says so.">
          <Combobox
            options={[...LEVELS]}
            value={level}
            onChange={setLevel}
            optionLabelOf={(l) => (isManagementLevel(l as Level) ? `${l} (management)` : l)}
            placeholder="Any level"
            inputClassName="field w-full px-3 py-3"
          />
        </Field>
      </Row>

      <Field label="Exact job title *" hint="Word for word from your offer or contract — this is what we classify from.">
        <input
          name="exact_title"
          required
          placeholder="e.g. Senior Backend Engineer II, Payments"
          className="field w-full px-3 py-3"
        />
      </Field>

      <Row>
        <Field label="Company *">
          <Combobox
            options={options.companies}
            value={company}
            onChange={setCompany}
            placeholder="Search companies…"
            inputClassName="field w-full px-3 py-3"
            allowFreeText
          />
        </Field>
        <Field label="Annual base (EUR) *" hint="Base only — no bonus or equity.">
          <input name="base_eur" type="number" min={0} step={1000} required placeholder="75000" className="field tnum w-full px-3 py-3" />
        </Field>
      </Row>

      <Row>
        <Field label="City">
          <Combobox
            options={options.cities}
            value={city}
            onChange={setCity}
            placeholder="Search cities…"
            inputClassName="field w-full px-3 py-3"
            allowFreeText
          />
        </Field>
        <Field label="Country">
          <Combobox
            options={options.countries}
            value={country}
            onChange={setCountry}
            placeholder="Search countries…"
            inputClassName="field w-full px-3 py-3"
            allowFreeText
          />
        </Field>
      </Row>

      <Field label="Proof type">
        <select name="proof_type" className="field w-full px-3 py-3" defaultValue="">
          <option value="">Prefer not to say</option>
          {["Offer letter", "Payslip", "Contract", "Verbal offer"].map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </Field>

      {/* Total-comp context — optional, and honest about where it goes. */}
      <div className="rounded-card border" style={{ borderColor: "var(--border)" }}>
        <button
          type="button"
          onClick={() => setShowContext((v) => !v)}
          className="flex w-full items-center gap-3 px-4 py-3 text-left text-[14px] font-medium"
        >
          <span className="icon-chip"><Icon.spark size={15} /></span>
          <span>Add bonus, equity or a note</span>
          <span className="ml-auto text-[12px] font-normal text-ink-faint">optional</span>
          <span className={`arw text-ink-faint transition-transform ${showContext ? "rotate-90" : ""}`}>›</span>
        </button>
        {showContext && (
          <div className="space-y-4 border-t px-4 py-4" style={{ borderColor: "var(--border)" }}>
            <p className="text-[12px] leading-relaxed text-ink-faint">
              These are kept as <span className="text-ink">total comp context</span> and shown separately. They never
              enter a base-salary median — every median on this site is advertised base pay only, and mixing bonus or
              equity into one would quietly inflate it.
            </p>
            <Row>
              <Field label="Annual cash bonus (EUR)">
                <input name="bonus_eur" type="number" min={0} step={1000} placeholder="10000" className="field tnum w-full px-3 py-3" />
              </Field>
              <Field label="Equity / stock">
                <input name="equity_note" placeholder="e.g. 0.05% over 4 years, or RSUs ~€20k/yr" className="field w-full px-3 py-3" />
              </Field>
            </Row>
            <Field label="Anything else the reviewer should know?">
              <textarea name="comments" rows={3} maxLength={1000} placeholder="Shift allowance, 4-day week, remote stipend…" className="field w-full px-3 py-3" />
            </Field>
          </div>
        )}
      </div>

      <div className="pt-1">
        <PrimaryButton className="w-full">Submit for review</PrimaryButton>
      </div>
      <p className="text-center text-xs text-ink-faint">
        Anonymous. Reviewed by a human before use. Never attributed to you or shown as an individual data point.
      </p>
    </form>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs text-ink-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-ink-faint">{hint}</span>}
    </label>
  );
}
