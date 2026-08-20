"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export interface SubNavItem { label: string; href: string }

// Index-site style strip: small mono tabs, underline active. Active resolves to
// exact path for page tabs, or the current #hash for same-page anchor tabs
// (defaulting to the first anchor when no hash is set).
export function SubNav({ items }: { items: SubNavItem[] }) {
  const pathname = usePathname();
  const [hash, setHash] = useState("");
  useEffect(() => {
    const update = () => setHash(window.location.hash);
    update();
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);

  const firstAnchor = items.find((i) => i.href.includes("#"))?.href;

  return (
    <nav className="-mx-1 mb-8 flex gap-1 overflow-x-auto border-b" style={{ borderColor: "var(--border)" }}>
      {items.map((it) => {
        const [path, anchor] = it.href.split("#");
        let active: boolean;
        if (anchor) {
          const onPage = path === "" || path === pathname;
          active = onPage && (hash === `#${anchor}` || (hash === "" && it.href === firstAnchor));
        } else {
          active = path === pathname;
        }
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`whitespace-nowrap px-3 py-2.5 text-[13px] font-medium transition-colors ${
              active ? "text-ink" : "text-ink-faint hover:text-ink-muted"
            }`}
            style={active ? { boxShadow: "inset 0 -2px 0 0 var(--ink)" } : undefined}
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
