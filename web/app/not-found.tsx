import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-28 text-center">
      <div className="tnum text-5xl font-semibold text-ink-faint">404</div>
      <p className="mt-4 text-ink-muted">That page isn&rsquo;t here.</p>
      <Link href="/" className="btn-ghost mt-6 inline-flex rounded-xl px-4 py-2.5 text-sm">Back to search</Link>
    </div>
  );
}
