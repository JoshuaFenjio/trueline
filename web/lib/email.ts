import "server-only";

// Email sender — SCAFFOLD. Activates when RESEND_API_KEY is set (Resend's HTTP
// API needs no SDK). Until then it no-ops and logs the message, so the flows
// that "send" an email (magic-link verify, publish notifications) still work
// end-to-end — the link is in the server log and can be followed in dev.
export const emailConfigured = Boolean(process.env.RESEND_API_KEY);

const FROM = process.env.EMAIL_FROM || "SalaryRadar <noreply@salaryradar.dev>";

export async function sendEmail(to: string, subject: string, html: string, text?: string): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[email:scaffold] would send to ${to} — "${subject}"\n${text || html.replace(/<[^>]+>/g, " ")}`);
    return false; // not delivered (no provider), but the caller proceeds
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
    return r.ok;
  } catch {
    return false;
  }
}
