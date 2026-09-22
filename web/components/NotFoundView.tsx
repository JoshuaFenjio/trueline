import { PillButton } from "@/components/blocks";

/**
 * One 404 view, rendered by app/not-found.tsx AND by a not-found.tsx inside
 * every dynamic segment that can call notFound().
 *
 * The per-segment files are not boilerplate: in Next 14 a notFound() thrown
 * from a dynamic route without a local not-found.tsx renders the framework's
 * bare fallback, so the SSR HTML came back with `<body>` and no root layout —
 * no nav, no footer. A not-found.tsx in the segment puts the 404 back inside
 * the layout chain.
 */
export function NotFoundView({
  what = "The link may be broken, or the company, role or city isn’t one we track yet.",
}: { what?: string }) {
  return (
    <div className="py-28 text-center">
      <span className="eyebrow-pill"><span className="eyebrow">404</span></span>
      <h1 className="t-h1 mx-auto mt-5 max-w-xl">This page isn&rsquo;t <span className="accent-italic">here.</span></h1>
      <p className="mx-auto mt-4 max-w-md text-lg text-ink-muted">{what}</p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <PillButton href="/">Search salaries</PillButton>
        <PillButton href="/roles">Browse role families</PillButton>
        <PillButton href="/leaderboards">Leaderboards</PillButton>
      </div>
    </div>
  );
}
