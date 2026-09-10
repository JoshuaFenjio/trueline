"use client";
import { useRouter } from "next/navigation";
import { Combobox } from "./Combobox";

// Standalone role selector for the search/result country view. Drives the URL
// (?role=), so the whole server-rendered view — H1, facts strip, company/city
// modules, country table+map — recomputes together and the link is shareable.
export function RolePicker({ roles, role, city }: { roles: string[]; role: string; city?: string }) {
  const router = useRouter();
  return (
    <Combobox
      options={roles}
      value={role}
      onChange={(v) => {
        const nv = v || "All roles";
        const p = new URLSearchParams();
        if (nv !== "All roles") p.set("role", nv);
        if (city && city !== "Any") p.set("city", city);
        router.push(`/${p.toString() ? "?" + p.toString() : ""}#results`);
      }}
      placeholder="All roles"
      clearValue="All roles"
      className="w-56"
      inputClassName="filter-pill w-full"
    />
  );
}
