import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

// Insert a waitlist / notify lead. Uses the publishable (anon) client — the
// leads table's RLS allows insert-only, so nothing readable is exposed.
export async function POST(req: Request) {
  let body: any = {};
  try { body = await req.json(); } catch { /* ignore */ }

  const email = String(body.email || "").trim().slice(0, 200);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }
  const source = body.source === "employer" ? "employer" : "candidate";
  const company = body.company ? String(body.company).trim().slice(0, 120) : null;

  const sb = getSupabase();
  if (!sb) return NextResponse.json({ error: "unconfigured" }, { status: 500 });

  const { error } = await sb.from("leads").insert({ email, company, source });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
