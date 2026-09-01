"use client";
import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons";

// Email-capture for a role we don't track yet. Honest throughout: we don't
// "summon" data — a role is a new LABEL on postings we largely already track.
export function RoleRequestForm({ query }: { query: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [matching, setMatching] = useState<number | null>(null);
  const [emailConfigured, setEmailConfigured] = useState(true);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending"); setErr("");
    try {
      const r = await fetch("/api/role-request", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, query }),
      });
      const d = await r.json();
      if (!r.ok) {
        setErr(d.error === "rate_limited" ? "Too many requests — try again later."
          : d.error === "not_migrated" ? "Requests aren't switched on yet. Check back soon."
          : "Something went wrong. Please try again.");
        setState("error"); return;
      }
      setMatching(d.matching ?? 0);
      setEmailConfigured(d.emailConfigured !== false);
      setState("done");
    } catch {
      setErr("Network error. Please try again."); setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className="card">
        <div className="flex items-center gap-2.5"><span className="icon-chip"><Icon.check size={15} /></span>
          <div className="text-[15px] font-semibold">Request logged</div></div>
        <p className="mt-3 max-w-prose text-[14px] leading-relaxed text-ink-muted">
          We already track <span className="tnum font-semibold text-ink">{matching?.toLocaleString()}</span> live
          postings that may match <span className="font-medium text-ink">“{query}”</span>. We&rsquo;ll classify it and
          email you when it has enough data to publish. A new role is a new label on postings we largely already
          track — we won&rsquo;t promise data we don&rsquo;t have.
        </p>
        <p className="mt-3 text-[13px] text-ink-faint">
          {emailConfigured
            ? "Check your inbox for a confirmation link to verify your email."
            : "We’ve recorded your request. Email verification turns on once our mailer is connected."}
        </p>
        <div className="mt-5"><Link href="/roles" className="pill-btn"><span>Browse tracked roles</span><span className="arw">→</span></Link></div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card">
      <div className="flex items-center gap-2.5"><span className="icon-chip"><Icon.search size={15} /></span>
        <div className="text-[15px] font-semibold">Request &ldquo;{query}&rdquo;</div></div>
      <p className="mt-3 max-w-prose text-[14px] leading-relaxed text-ink-muted">
        We don&rsquo;t label <span className="font-medium text-ink">&ldquo;{query}&rdquo;</span> as a role family yet.
        Leave your email and we&rsquo;ll classify it against the postings we already scrape and tell you when it has
        enough disclosed salaries to publish honestly.
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="you@work.com"
          className="min-w-0 flex-1 rounded-lg border px-3.5 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
          style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
        />
        <button type="submit" disabled={state === "sending"} className="btn-primary shrink-0 rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-60">
          {state === "sending" ? "Sending…" : "Request this role"}
        </button>
      </div>
      {err && <p className="mt-2 text-[13px] text-[var(--danger,#b4432f)]">{err}</p>}
      <p className="mt-3 text-[12px] text-ink-faint">Email-verified, no account or password. One-tap unsubscribe in every mail.</p>
    </form>
  );
}
