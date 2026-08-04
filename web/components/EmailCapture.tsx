"use client";
import { useState } from "react";

interface Props {
  source: "employer" | "candidate";
  withCompany?: boolean;
  cta?: string;
  placeholder?: string;
}

export function EmailCapture({ source, withCompany = false, cta = "Notify me", placeholder = "you@work.com" }: Props) {
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (state === "loading") return;
    setState("loading");
    try {
      const r = await fetch("/api/lead", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, company, source }),
      });
      setState(r.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return <p className="text-sm" style={{ color: "var(--mint)" }}>You&apos;re on the list. We&apos;ll email you.</p>;
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
      {withCompany && (
        <input
          value={company} onChange={(e) => setCompany(e.target.value)}
          placeholder="Company" className="field px-3 py-2.5 text-sm"
        />
      )}
      <input
        value={email} onChange={(e) => setEmail(e.target.value)}
        type="email" required placeholder={placeholder}
        className="field min-w-0 flex-1 px-3 py-2.5 text-sm"
      />
      <button type="submit" className="btn-primary shrink-0 rounded-xl px-4 py-2.5 text-sm">
        {state === "loading" ? "…" : cta}
      </button>
      {state === "error" && <span className="text-xs" style={{ color: "var(--ember)" }}>Something went wrong — try again.</span>}
    </form>
  );
}
