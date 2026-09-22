"use client";
import { useState } from "react";
import { familyLabel } from "@/lib/roleNames";

/**
 * Post-submission email opt-in. Deliberately plain: one field, one button, the
 * scope stated above it and the unsubscribe promise beside it. Nothing is
 * pre-filled or pre-consented, skipping costs nothing (the submission is
 * already saved), and the success state doesn't pretend anything more happened
 * than an address being recorded.
 */
export function InsightsOptIn({ role }: { role?: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const label = role ? familyLabel(role) : "";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (state === "sending") return;
    setState("sending");
    try {
      const r = await fetch("/api/lead", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, source: "insights", role: role || null }),
      });
      setState(r.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <p className="text-sm" style={{ color: "var(--mint)" }}>
        Done — we&rsquo;ll email <span className="font-medium">{email}</span> when the{" "}
        {label || "benchmark"} moves. Unsubscribe from any message.
      </p>
    );
  }

  return (
    <form onSubmit={submit}>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          aria-label="Email address for salary insights"
          className="field min-w-0 flex-1 px-3 py-2.5 text-sm"
        />
        <button type="submit" disabled={state === "sending"} className="btn-primary shrink-0 rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-60">
          {state === "sending" ? "Saving…" : "Email me updates"}
        </button>
      </div>
      <p className="mt-2 text-[12px] text-ink-faint">
        One-tap unsubscribe in every email. No account, and we never sell or share your address.
      </p>
      {state === "error" && <p className="mt-2 text-[12px]" style={{ color: "var(--ember)" }}>That didn&rsquo;t save. Please try again.</p>}
    </form>
  );
}
