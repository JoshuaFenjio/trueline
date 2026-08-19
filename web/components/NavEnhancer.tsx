"use client";
import { useEffect } from "react";

// Progressive enhancement over the <details>-based nav menus: opening one closes
// the others, a click outside closes all, Escape closes all. Without JS the
// <details> menus still open/close on click (no-JS fallback intact).
export function NavEnhancer() {
  useEffect(() => {
    const menus = () => Array.from(document.querySelectorAll("details[data-navmenu]")) as HTMLDetailsElement[];
    const onToggle = (e: Event) => {
      const t = e.target as HTMLDetailsElement;
      if (t.open) menus().forEach((m) => { if (m !== t) m.open = false; });
    };
    const onDocClick = (e: MouseEvent) => {
      menus().forEach((m) => { if (m.open && !m.contains(e.target as Node)) m.open = false; });
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") menus().forEach((m) => (m.open = false)); };
    const list = menus();
    list.forEach((m) => m.addEventListener("toggle", onToggle));
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      list.forEach((m) => m.removeEventListener("toggle", onToggle));
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);
  return null;
}
