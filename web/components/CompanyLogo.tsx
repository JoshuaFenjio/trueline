"use client";
import { useState } from "react";
import { companyMeta, logoDomain } from "@/lib/companyMeta";

// Company logo with a resolution CHAIN: manual override (meta.logo — full URL or
// local /logos/*) → DuckDuckGo icon (token-free) → Google favicon by domain →
// letter-mark. Each source that errors advances to the next, so a domain DDG
// happens to miss still resolves via Google before falling back.
//
// The domain itself comes from logoDomain(): the curated companyMeta website
// first, then the machine-resolved map in lib/companyDomains, which covers
// every scraped company we could verify (own-domain posting evidence, or a
// name match confirmed against the site's own homepage title). A company we
// could not verify stays a letter-mark — a wrong logo is worse than none.
export function CompanyLogo({
  name, size = 32, rounded = "rounded-md", className = "", domain: domainProp,
}: { name: string; size?: number; rounded?: string; className?: string; domain?: string }) {
  const meta = companyMeta(name);
  // logoDomain() adds the machine-resolved domains (lib/companyDomains) on top
  // of the curated websites — good enough to fetch an icon from, never shown
  // as a company fact.
  const domain = domainProp || logoDomain(name);
  const [step, setStep] = useState(0);

  const sources: string[] = [];
  if (meta.logo) sources.push(meta.logo);
  if (domain) {
    sources.push(`https://icons.duckduckgo.com/ip3/${domain}.ico`);
    sources.push(`https://www.google.com/s2/favicons?domain=${domain}&sz=64`);
  }

  const box = `flex shrink-0 items-center justify-center overflow-hidden ${rounded} ${className}`;
  const style = { width: size, height: size } as const;

  if (step >= sources.length) {
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
        src={sources[step]}
        alt=""
        width={size} height={size}
        loading="lazy"
        onError={() => setStep((s) => s + 1)}
        style={{ width: size, height: size, objectFit: "contain" }}
      />
    </span>
  );
}
