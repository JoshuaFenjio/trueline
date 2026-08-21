import Link from "next/link";
import { ReactNode } from "react";

// The one card spec (see .card in globals): white, hairline, 14px radius,
// two-layer shadow, 24px padding. `hover` adds the lift-on-hover affordance.
export function Card({
  children, className = "", as: Tag = "div", hover = false,
}: { children: ReactNode; className?: string; as?: any; hover?: boolean }) {
  return (
    <Tag className={`card ${hover ? "card-hover" : ""} ${className}`}>{children}</Tag>
  );
}

export function Pill({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs md:text-sm ${className}`}
      style={{ background: "var(--surface-2)" }}
    >
      {children}
    </span>
  );
}

export function LiveDot() {
  return (
    <span className="relative flex h-2 w-2">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: "var(--mint)" }} />
      <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: "var(--mint)" }} />
    </span>
  );
}

export function PrimaryButton({ children, type = "submit", className = "" }: { children: ReactNode; type?: "submit" | "button"; className?: string }) {
  return (
    <button type={type} className={`btn-primary rounded-xl px-5 py-3 text-sm ${className}`}>
      {children}
    </button>
  );
}

export function GhostLink({ href, children, className = "" }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link href={href} className={`btn-ghost inline-flex items-center rounded-xl px-4 py-2.5 text-sm ${className}`}>
      {children}
    </Link>
  );
}

import { payColor } from "@/lib/payScale";
// Pay Score color = the shared 5-step semantic scale (see lib/payScale).
export function scoreColor(score: number): string {
  return payColor(score);
}

export function ScoreBadge({ score, size = "md" }: { score: number; size?: "sm" | "md" | "lg" }) {
  const color = scoreColor(score);
  const dim = size === "lg" ? "h-20 w-20 text-3xl" : size === "sm" ? "h-10 w-10 text-sm" : "h-14 w-14 text-xl";
  return (
    <div
      className={`tnum inline-flex items-center justify-center rounded-2xl font-semibold ${dim}`}
      style={{ color, border: `1px solid ${color}40`, background: `${color}14` }}
    >
      {score}
    </div>
  );
}

export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: string }) {
  return (
    <div>
      <div className="tnum text-lg md:text-xl font-semibold" style={tone ? { color: tone } : undefined}>{value}</div>
      <div className="text-xs text-ink-faint mt-0.5">{label}</div>
    </div>
  );
}
