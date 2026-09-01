import { NextResponse } from "next/server";
import { createRequest, requestRate, normQuery } from "@/lib/roleRequests";
import { sendEmail, emailConfigured } from "@/lib/email";
import { magicLinkEmail } from "@/lib/emailTemplates";
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
  const mail = magicLinkEmail(query, r.matching ?? 0, link);
  const delivered = await sendEmail(email, mail.subject, mail.html, mail.text);

  return NextResponse.json({ ok: true, matching: r.matching, emailSent: delivered, emailConfigured });
}
