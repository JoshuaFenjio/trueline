"use client";
import { useState } from "react";
import { companyMeta } from "@/lib/companyMeta";

// Real company logo by stored domain (DuckDuckGo's icon service — token-free,
// unlike logo.dev, and unlike Clearbit's now-dead free API), with the letter-
// mark as a graceful fallback whenever we have no domain or the fetch fails.
// We only ever know a domain for the companies in companyMeta, so unknowns
// stay letter-marks.
export function CompanyLogo({
  name, size = 32, rounded = "rounded-md", className = "",
}: { name: string; size?: number; rounded?: string; className?: string }) {
  const domain = companyMeta(name).website;
  const [failed, setFailed] = useState(false);

  const box = `flex shrink-0 items-center justify-center overflow-hidden ${rounded} ${className}`;
  const style = { width: size, height: size } as const;

  if (!domain || failed) {
    return (
      <span className={box} style={{ ...style, background: "var(--surface-3)", color: "var(--ink-muted)", fontSize: Math.round(size * 0.42), fontWeight: 600 }}>
        {name.charAt(0)}
      </span>
    );
  }
  return (
    <span className={box} style={{ ...style, background: "#fff", border: "1px solid var(--border)" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://icons.duckduckgo.com/ip3/${domain}.ico`}
        alt=""
        width={size} height={size}
        loading="lazy"
        onError={() => setFailed(true)}
        style={{ width: size, height: size, objectFit: "contain" }}
      />
    </span>
  );
}
