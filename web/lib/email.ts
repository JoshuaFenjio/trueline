import "server-only";

// Email sender — SCAFFOLD. Activates when RESEND_API_KEY is set (Resend's HTTP
// API needs no SDK). Until then it no-ops and logs the message, so the flows
// that "send" an email (magic-link verify, publish notifications) still work
// end-to-end — the link is in the server log and can be followed in dev.
export const emailConfigured = Boolean(process.env.RESEND_API_KEY);

// Sending identity. If EMAIL_FROM is set we assume it's an address on a domain
// verified in Resend and use it verbatim. If it's NOT set we can't send from an
// unverified vanity domain (Resend 403s), so we fall back to Resend's built-in
// onboarding@resend.dev sender — which delivers ONLY to the Resend account
// owner. That keeps dev/staging working end-to-end instead of silently 403ing;
// the log line below makes the limitation explicit. Set EMAIL_FROM to a
// verified-domain address to reach all recipients.
const OWNER_ONLY = !process.env.EMAIL_FROM;
const FROM = process.env.EMAIL_FROM || "SalaryRadar <onboarding@resend.dev>";

export async function sendEmail(to: string, subject: string, html: string, text?: string): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[email:scaffold] would send to ${to} — "${subject}"\n${text || html.replace(/<[^>]+>/g, " ")}`);
    return false; // not delivered (no provider), but the caller proceeds
  }
  if (OWNER_ONLY) {
    console.warn(
      "[email] owner-only mode, no verified sending domain — sending via onboarding@resend.dev " +
        "(delivers only to the Resend account owner). Set EMAIL_FROM to an address on a domain " +
        "verified at resend.com/domains to reach all recipients."
    );
  }
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM, to, subject, html, text }),
    });
    if (!r.ok) {
      // Never fail silently — surface the provider's reason (e.g. a 403 for an
      // unverified domain, or owner-only mode rejecting a non-owner recipient).
      console.error(`[email] send to ${to} failed — HTTP ${r.status}: ${await r.text()}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error(`[email] send to ${to} threw:`, e);
    return false;
  }
}
