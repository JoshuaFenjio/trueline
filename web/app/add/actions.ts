"use server";

import { redirect } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { slugify } from "@/lib/format";

export async function submitSalary(formData: FormData) {
  const sb = getSupabase();
  if (!sb) redirect("/add?error=config");

  const str = (k: string, n: number) => String(formData.get(k) || "").trim().slice(0, n) || null;
  const num = (k: string) => {
    const v = Number(formData.get(k));
    return Number.isFinite(v) && v > 0 ? Math.round(v) : null;
  };

  // Core row — the only fields any statistic ever reads.
  const core = {
    role_family: str("role_family", 80),
    level: str("level", 40),
    company: str("company", 120),
    city: str("city", 80),
    country: str("country", 80),
    base_eur: num("base_eur"),
    proof_type: str("proof_type", 40),
    status: "pending" as const,
  };

  // Total-comp context. Stored alongside, shown to the reviewer, and displayed
  // later as its own clearly-labelled thing. NEVER blended into base medians.
  const context = {
    exact_title: str("exact_title", 160),
    bonus_eur: num("bonus_eur"),
    equity_note: str("equity_note", 240),
    comments: str("comments", 1000),
  };

  if (!core.role_family || !core.company || !core.base_eur || !context.exact_title) {
    redirect("/add?error=missing");
  }

  let { error } = await sb!.from("submissions").insert({ ...core, ...context });
  if (error) {
    // migrations/2026-09-submission-context.sql may not be applied yet. A
    // submission is too valuable to drop over a missing optional column, so
    // retry with the core row and keep the context in `comments` if that
    // column exists, or discard it rather than lose the salary.
    const missingCol = /column .* does not exist|could not find the .* column|schema cache/i.test(error.message);
    if (!missingCol) redirect("/add?error=save");
    const note = [
      context.exact_title ? `title: ${context.exact_title}` : null,
      context.bonus_eur ? `bonus: €${context.bonus_eur}` : null,
      context.equity_note ? `equity: ${context.equity_note}` : null,
      context.comments,
    ].filter(Boolean).join(" · ").slice(0, 1000);
    let retry = await sb!.from("submissions").insert({ ...core, comments: note });
    if (retry.error) retry = await sb!.from("submissions").insert(core);
    if (retry.error) redirect("/add?error=save");
  }

  redirect(`/add/thanks?role=${encodeURIComponent(core.role_family)}&slug=${slugify(core.role_family)}`);
}
