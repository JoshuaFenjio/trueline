import { NextResponse } from "next/server";
import { createRequest, requestRate, normQuery } from "@/lib/roleRequests";
import { sendEmail, emailConfigured } from "@/lib/email";
import { SITE_URL } from "@/lib/site";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  if (!requestRate(ip).ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let body: any = {};
  try { body = await req.json(); } catch { /* ignore */ }
  const email = String(body.email || "").trim().slice(0, 200);
  const query = String(body.query || "").trim().slice(0, 120);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  if (query.length < 2) return NextResponse.json({ error: "invalid_query" }, { status: 400 });

  const r = await createRequest(query, email);
  if (!r.ok) {
    const status = r.error === "not_migrated" ? 503 : 500;
    return NextResponse.json({ error: r.error }, { status });
  }

  // Magic-link verification (scaffolded delivery — see lib/email.ts).
  const link = `${SITE_URL}/request/verify?e=${encodeURIComponent(email)}&q=${encodeURIComponent(normQuery(query))}&t=${r.token}`;
  const delivered = await sendEmail(
    email,
    `Confirm your request to track “${query}”`,
    `<p>Confirm you asked SalaryRadar to track <strong>${query}</strong>:</p>
     <p><a href="${link}">Confirm my request →</a></p>
     <p style="color:#666;font-size:13px">We already track ${r.matching} live postings that may match. We'll classify
     “${query}” and email you when it has enough data to publish. We don't summon new data — a role is a new label on
     postings we largely already track.</p>`,
    `Confirm your request to track "${query}": ${link}`
  );

  return NextResponse.json({ ok: true, matching: r.matching, emailSent: delivered, emailConfigured });
}
