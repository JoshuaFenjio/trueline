import { NotFoundView } from "@/components/NotFoundView";

// Present so notFound() from this segment keeps the root layout (nav + footer).
// See components/NotFoundView for why this file has to exist per segment.
export default function NotFound() {
  return <NotFoundView what="We don’t track enough live job ads in that city to publish a page for it yet." />;
}
