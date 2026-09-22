"use client";
import { usePathname } from "next/navigation";

/**
 * Picks the footer variant by route. The admin console is a private review
 * tool — a marketing footer with a newsletter sign-up is noise there — so it
 * gets the slim one. Everything else gets the full footer.
 *
 * Both variants are rendered on the server and passed in as nodes; this only
 * chooses between them, so no data fetching moves to the client.
 */
export function FooterSwitch({ full, slim }: { full: React.ReactNode; slim: React.ReactNode }) {
  const path = usePathname() || "";
  return <>{path === "/admin" || path.startsWith("/admin/") ? slim : full}</>;
}
