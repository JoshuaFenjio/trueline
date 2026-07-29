"use server";

import { redirect } from "next/navigation";
import { getSupabase } from "@/lib/supabase";

export async function submitSalary(formData: FormData) {
  const sb = getSupabase();
  if (!sb) redirect("/add?error=config");

  const base = Number(formData.get("base_eur"));
  const row = {
    role_family: String(formData.get("role_family") || "").slice(0, 80) || null,
    level: String(formData.get("level") || "").slice(0, 40) || null,
    company: String(formData.get("company") || "").slice(0, 120) || null,
    city: String(formData.get("city") || "").slice(0, 80) || null,
    country: String(formData.get("country") || "").slice(0, 80) || null,
    base_eur: Number.isFinite(base) && base > 0 ? Math.round(base) : null,
    proof_type: String(formData.get("proof_type") || "").slice(0, 40) || null,
    status: "pending" as const,
  };

  if (!row.role_family || !row.company || !row.base_eur) {
    redirect("/add?error=missing");
  }

  const { error } = await sb!.from("submissions").insert(row);
  if (error) redirect("/add?error=save");
  redirect("/add?submitted=1");
}
