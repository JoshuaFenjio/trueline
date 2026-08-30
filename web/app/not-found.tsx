import Link from "next/link";
import { PillButton } from "@/components/blocks";

export default function NotFound() {
  return (
    <div className="py-28 text-center">
      <span className="eyebrow-pill"><span className="eyebrow">404</span></span>
      <h1 className="t-h1 mx-auto mt-5 max-w-xl">This page isn&rsquo;t <span className="accent-italic">here.</span></h1>
      <p className="mx-auto mt-4 max-w-md text-lg text-ink-muted">The link may be broken, or the company, role or city isn&rsquo;t one we track yet.</p>
      <div className="mt-7 flex justify-center gap-3">
        <PillButton href="/">Search salaries</PillButton>
        <PillButton href="/leaderboards">Leaderboards</PillButton>
      </div>
    </div>
  );
}
