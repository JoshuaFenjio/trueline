import { NotFoundView } from "@/components/NotFoundView";

// Present so notFound() from this segment keeps the root layout (nav + footer).
// See components/NotFoundView for why this file has to exist per segment.
export default function NotFound() {
  return <NotFoundView what="That role and seniority combination isn’t one we track." />;
}
