import "server-only";

// Branded transactional email templates. Table-based, all-inline CSS — the only
// layout HTML email clients render reliably. The compass mark is inline SVG
// (renders in Apple Mail / Outlook-mac / many clients; Gmail-web strips SVG, so
// the teal "SalaryRadar" wordmark beside it is the guaranteed-visible fallback).
// Web fonts don't load in most clients, so the Schibsted stack degrades to the
// system sans — intended, not a bug.

const TEAL = "#0f766e";
const TEAL_DEEP = "#0b4f4a";
const INK = "#171614";
const INK_MUTED = "#6b6660";
const PAPER = "#fafaf7";
const BORDER = "#e7e5df";
const FONT =
  "'Schibsted Grotesk',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const TAGLINE = "Honest salary benchmarks for Europe — built only from disclosed pay, never estimates.";

// The compass/radar mark, geometry kept in sync with components/BrandMark.tsx.
const MARK = `<svg width="28" height="28" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle;display:inline-block">
  <rect width="32" height="32" rx="8" fill="${INK}"/>
  <circle cx="16" cy="16" r="9" fill="none" stroke="${TEAL}" stroke-width="2"/>
  <g transform="rotate(45 16 16)">
    <path d="M16 7 L18.2 16 L16 25 L13.8 16 Z" fill="${TEAL}"/>
    <path d="M7 16 L16 13.8 L25 16 L16 18.2 Z" fill="${TEAL}" opacity="0.5"/>
  </g>
  <circle cx="16" cy="16" r="1.6" fill="${INK}"/>
</svg>`;

interface Shell {
  title: string; // preheader + h1
  bodyHtml: string; // inner content (already-escaped)
  cta?: { label: string; href: string };
  preheader?: string;
}

// Escape user-supplied text before it goes anywhere near the HTML body.
export function esc(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
  );
}

function shell({ title, bodyHtml, cta, preheader }: Shell): string {
  const button = cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0">
         <tr><td style="border-radius:10px;background:${TEAL}">
           <a href="${cta.href}" style="display:inline-block;padding:12px 22px;font-family:${FONT};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px">${esc(
             cta.label
           )}</a>
         </td></tr>
       </table>`
    : "";
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"></head>
<body style="margin:0;padding:0;background:${PAPER};font-family:${FONT};-webkit-font-smoothing:antialiased">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader || title)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="width:480px;max-width:100%">
        <!-- header -->
        <tr><td style="padding:0 4px 20px">
          ${MARK}
          <span style="font-family:${FONT};font-size:18px;font-weight:700;color:${TEAL};letter-spacing:-.01em;vertical-align:middle;margin-left:8px">SalaryRadar</span>
        </td></tr>
        <!-- card -->
        <tr><td style="background:#ffffff;border:1px solid ${BORDER};border-radius:14px;padding:32px">
          <h1 style="margin:0 0 12px;font-family:${FONT};font-size:22px;line-height:1.25;font-weight:700;color:${INK};letter-spacing:-.02em">${esc(
            title
          )}</h1>
          ${bodyHtml}
          ${button}
        </td></tr>
        <!-- footer -->
        <tr><td style="padding:20px 4px 0">
          <p style="margin:0 0 4px;font-family:${FONT};font-size:12px;line-height:1.5;color:${INK_MUTED}">${esc(
            TAGLINE
          )}</p>
          <p style="margin:0;font-family:${FONT};font-size:12px;color:${TEAL_DEEP}">SalaryRadar</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

// --- Magic-link confirmation -------------------------------------------------
export function magicLinkEmail(query: string, matching: number, link: string): {
  subject: string; html: string; text: string;
} {
  const q = esc(query);
  const n = (matching || 0).toLocaleString();
  const subject = `Confirm your request to track "${query}"`;
  const html = shell({
    title: `Confirm your role request`,
    preheader: `Confirm you asked SalaryRadar to track "${query}".`,
    cta: { label: "Confirm my request", href: link },
    bodyHtml: `
      <p style="margin:0 0 14px;font-family:${FONT};font-size:15px;line-height:1.55;color:${INK}">
        You asked us to track <strong style="color:${TEAL_DEEP}">${q}</strong>. Tap the button to confirm it's really you.
      </p>
      <p style="margin:0;font-family:${FONT};font-size:13px;line-height:1.55;color:${INK_MUTED}">
        We already track <strong>${n}</strong> live postings that may match. We'll classify &ldquo;${q}&rdquo; and email you
        once the slice has enough disclosed pay to publish — a role is a new label on data we largely already hold, not a
        promise of numbers we don't have.
      </p>`,
  });
  const text = [
    `Confirm your role request`,
    ``,
    `You asked SalaryRadar to track "${query}". Confirm it's you:`,
    link,
    ``,
    `We already track ${n} live postings that may match. We'll classify "${query}" and email you once the slice has enough disclosed pay to publish.`,
    ``,
    TAGLINE,
    `SalaryRadar`,
  ].join("\n");
  return { subject, html, text };
}
