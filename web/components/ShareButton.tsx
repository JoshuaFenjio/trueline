"use client";
import { useState } from "react";

// Copies a URL that restores the current view. If `path` is given it's resolved
// against the current origin (for a specific leaderboard section); otherwise the
// full current URL is copied (search results already carry their query params).
export function ShareButton({ path, label = "Share" }: { path?: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const url = path
      ? new URL(path, window.location.origin).toString()
      : window.location.href;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const t = document.createElement("textarea");
      t.value = url;
      document.body.appendChild(t);
      t.select();
      document.execCommand("copy");
      t.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="tnum inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] uppercase tracking-wider text-ink-muted transition-colors hover:text-ink"
      style={{ background: "var(--surface-1)" }}
    >
      {copied ? "Copied ✓" : (
        <>
          {label} <span aria-hidden>↗</span>
        </>
      )}
    </button>
  );
}
