import type { Metadata } from "next";
import { submitSalary } from "./actions";
import { LEVELS } from "@/lib/levels";
import { Card, PrimaryButton } from "@/components/ui";
import { Breadcrumbs } from "@/components/blocks";

export const metadata: Metadata = {
  title: "Add your salary",
  description: "Add your salary anonymously to improve Europe's pay benchmarks. Reviewed by a human, never attributed to you.",
};

const ROLE_FAMILIES = [
  "Software Engineer", "Frontend", "Backend", "Mobile", "ML/AI Engineer",
  "Research Scientist", "Data Engineer", "Data Scientist", "Data Analyst",
  "DevOps/Platform", "Security Engineer", "SecOps", "Hardware/Embedded",
  "QA/Test", "Engineering Manager", "Solutions Engineer", "Product Manager",
  "Product Marketing", "Designer",
  "Account Executive", "Account Manager", "SDR/BDR", "BizDev/Partnerships",
  "Marketing", "Content", "Brand", "Performance Marketing",
  "Customer Success", "Support",
  "Operations", "BizOps", "Strategy", "Consultant", "Office/EA",
  "Finance", "FP&A", "Accounting", "Payroll",
  "Legal", "Compliance", "People/HR", "Recruiter/TA", "Other",
];
const PROOF = ["Offer letter", "Payslip", "Contract", "Verbal offer", "Prefer not to say"];

export default function AddPage({ searchParams }: { searchParams: { submitted?: string; error?: string; company?: string } }) {
  const submitted = searchParams.submitted === "1";
  const error = searchParams.error;
  const company = searchParams.company || "";

  return (
    <div className="mx-auto max-w-xl pb-4">
      <div className="pt-8"><Breadcrumbs items={[{ label: "Add your salary" }]} /></div>
      <span className="eyebrow-pill mt-6"><span className="eyebrow">Add your salary</span></span>
      <h1 className="t-h1 mt-5">Add your salary <span className="font-normal italic">anonymously.</span></h1>
      <p className="mt-4 text-lg leading-relaxed text-ink-muted">
        Every verified number makes the benchmarks truer. Takes 30 seconds.
      </p>

      {submitted && (
        <div className="mt-6 rounded-card border p-4" style={{ background: "rgba(74,222,156,.08)", borderColor: "rgba(74,222,156,.35)" }}>
          <p className="text-sm" style={{ color: "var(--mint)" }}>
            Thank you. Your salary is in the review queue. A human checks each one before it&apos;s ever used.
          </p>
          <div className="mt-3 flex gap-4 text-sm">
            <a href="/" className="text-brand-2 hover:underline">Search the data →</a>
            <a href="/leaderboards" className="text-brand-2 hover:underline">See who pays most →</a>
          </div>
        </div>
      )}
      {error && (
        <div className="mt-6 rounded-card border p-4" style={{ background: "rgba(255,106,69,.08)", borderColor: "rgba(255,106,69,.35)" }}>
          <p className="text-sm" style={{ color: "var(--ember)" }}>
            {error === "missing" ? "Please fill in at least role, company and base salary."
              : error === "config" ? "Submissions aren't configured yet."
              : "Something went wrong saving that. Please try again."}
          </p>
        </div>
      )}

      <Card className="mt-6">
        <form action={submitSalary} className="space-y-4">
          <Row>
            <FieldSel name="role_family" label="Role family *" options={ROLE_FAMILIES} />
            <FieldSel name="level" label="Level" options={[...LEVELS]} />
          </Row>
          <Row>
            <FieldTxt name="company" label="Company *" placeholder="e.g. Monzo" defaultValue={company} />
            <FieldNum name="base_eur" label="Annual base (EUR) *" placeholder="75000" />
          </Row>
          <Row>
            <FieldTxt name="city" label="City" placeholder="e.g. London" />
            <FieldTxt name="country" label="Country" placeholder="e.g. United Kingdom" />
          </Row>
          <FieldSel name="proof_type" label="Proof type" options={PROOF} />

          <div className="pt-1">
            <PrimaryButton className="w-full">Submit for review</PrimaryButton>
          </div>
          <p className="text-center text-xs text-ink-faint">
            Anonymous. Reviewed by a human before use. Never attributed to you or shown as an individual data point.
          </p>
        </form>
      </Card>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>;
}
function Label({ children }: { children: React.ReactNode }) {
  return <span className="mb-1.5 block text-xs text-ink-muted">{children}</span>;
}
function FieldTxt({ name, label, placeholder, defaultValue }: { name: string; label: string; placeholder?: string; defaultValue?: string }) {
  return (
    <label className="block"><Label>{label}</Label>
      <input name={name} placeholder={placeholder} defaultValue={defaultValue} className="field w-full px-3 py-3" />
    </label>
  );
}
function FieldNum({ name, label, placeholder }: { name: string; label: string; placeholder?: string }) {
  return (
    <label className="block"><Label>{label}</Label>
      <input name={name} type="number" min={0} step={1000} placeholder={placeholder} className="field tnum w-full px-3 py-3" />
    </label>
  );
}
function FieldSel({ name, label, options }: { name: string; label: string; options: string[] }) {
  return (
    <label className="block"><Label>{label}</Label>
      <select name={name} className="field w-full px-3 py-3" defaultValue="">
        <option value="" disabled>Select…</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}
