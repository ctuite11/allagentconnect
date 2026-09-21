/* ------------------------------------------------------------------ */
/*  Activation Reminder — short nudge for verified, not-yet-activated  */
/*  agents. Admin-triggered resend only; reuses the same secure        */
/*  30-day activation token path as the License Verified email.        */
/* ------------------------------------------------------------------ */

import type { FooterAgent } from "./buildLicenseVerifiedEmailHtml.ts";

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const NAVY = "#111317";
const EMERALD_ACCENT = "#50c878";
const CTA_GREEN = "#16A34A";
const TEXT_DARK = "#0f172a";
const TEXT_BODY = "#334155";
const TEXT_MUTED = "#64748b";
const BORDER = "#e5e7eb";
const MONOGRAM_URL = "https://allagentconnect.com/email/aac-monogram-green-128.png";
const FONT = "system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif";

function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 11 && d.startsWith("1")) return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return raw;
}

/** Compact founder signature — same person/card as the other activation emails. */
function renderFounderFooter(agent: FooterAgent): string {
  const fullName = [agent.firstName, agent.lastName].filter(Boolean).join(" ").trim();
  const initials = [agent.firstName, agent.lastName]
    .filter(Boolean)
    .map((p) => (p as string).trim()[0]?.toUpperCase() ?? "")
    .join("");
  const avatarCell = agent.headshotUrl
    ? `<img src="${escapeHtml(agent.headshotUrl)}" width="72" height="72" alt="${escapeHtml(fullName)}" style="display:block;width:72px;height:72px;border-radius:50%;object-fit:cover;border:1px solid ${EMERALD_ACCENT};" />`
    : `<div style="width:72px;height:72px;border-radius:50%;background:${EMERALD_ACCENT};color:#fff;font-weight:700;font-size:24px;line-height:72px;text-align:center;font-family:${FONT};">${escapeHtml(initials || "AA")}</div>`;

  const lines: string[] = [];
  if (fullName) {
    lines.push(`<p style="margin:0;font-size:15px;font-weight:700;color:#fff;letter-spacing:-0.01em;font-family:${FONT};">${escapeHtml(fullName)}</p>`);
  }
  if (agent.title) {
    lines.push(`<p style="margin:2px 0 0;font-size:12px;color:rgba(255,255,255,0.72);font-family:${FONT};">${escapeHtml(agent.title)}</p>`);
  }
  const contactParts: string[] = [];
  if (agent.phone) {
    contactParts.push(`<a href="tel:${escapeHtml(agent.phone.replace(/[^0-9+]/g, ""))}" style="color:#fff;text-decoration:none;">${escapeHtml(formatPhone(agent.phone))}</a>`);
  }
  if (agent.email) {
    contactParts.push(`<a href="mailto:${escapeHtml(agent.email)}" style="color:#fff;text-decoration:none;">${escapeHtml(agent.email)}</a>`);
  }
  if (contactParts.length) {
    lines.push(`<p style="margin:6px 0 0;font-size:12px;color:#fff;font-family:${FONT};">${contactParts.join(" &nbsp;·&nbsp; ")}</p>`);
  }

  return `<table role="presentation" cellspacing="0" cellpadding="0" align="center"><tr>
    <td valign="middle" style="padding-right:14px;">${avatarCell}</td>
    <td valign="middle" align="left">${lines.join("")}</td>
  </tr></table>
  <p style="margin:16px 0 0;font-size:10.5px;color:rgba(255,255,255,0.45);font-family:${FONT};">All Agent Connect &middot; By Agents. For Agents. All Agents.</p>`;
}

export interface ActivationReminderEmailOptions {
  ctaUrl: string;
  agentName?: string | null;
  footerAgent?: FooterAgent | null;
  /** Small line under the CTA, e.g. the activation link expiry. */
  ctaNote?: string;
}

export function buildActivationReminderEmailHtml(opts: ActivationReminderEmailOptions): string {
  const { ctaUrl, footerAgent } = opts;
  const ctaNote = opts.ctaNote?.trim() || "";
  const firstName = opts.agentName?.trim();
  const greeting = firstName ? `Hi ${escapeHtml(firstName)},` : "Hi,";
  const preheader = "You're verified — one last step to activate your All Agent Connect account.";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Activate your account — All Agent Connect</title>
</head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:${FONT};">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#ffffff;">
    <tr><td align="center" style="padding:32px 16px 48px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;">

        <!-- Header -->
        <tr><td align="center" style="background-color:${NAVY};border-radius:14px 14px 0 0;padding:32px 40px 26px;">
          <img src="${MONOGRAM_URL}" width="44" height="44" alt="All Agent Connect" style="display:block;margin:0 auto;border:0;outline:none;text-decoration:none;" />
          <p style="margin:14px 0 0;font-size:18px;font-weight:600;letter-spacing:-0.02em;color:#ffffff;font-family:${FONT};">All Agent Connect</p>
          <div style="width:48px;height:2px;background-color:${EMERALD_ACCENT};margin:18px auto 20px;border-radius:1px;"></div>
          <h1 style="margin:0;font-size:24px;line-height:1.25;font-weight:700;letter-spacing:-0.02em;color:#ffffff;font-family:${FONT};">You're verified — one step left</h1>
        </td></tr>

        <!-- Body -->
        <tr><td style="background-color:#ffffff;border:1px solid ${BORDER};border-top:none;padding:32px 40px 8px;">
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${TEXT_BODY};font-family:${FONT};">${greeting}</p>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:${TEXT_BODY};font-family:${FONT};">Your license is verified and your All Agent Connect account is ready — you just haven't activated it yet.</p>
          <p style="margin:0 0 8px;font-size:15px;line-height:1.65;color:${TEXT_BODY};font-family:${FONT};">It takes less than a minute. Set your password and you're in.</p>

          <!-- CTA -->
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:12px 0 4px;">
            <tr><td align="center" style="padding:8px 0 6px;">
              <table role="presentation" cellspacing="0" cellpadding="0"><tr><td align="center" bgcolor="${CTA_GREEN}" style="border-radius:10px;">
                <a href="${ctaUrl}" target="_blank" style="display:inline-block;padding:15px 34px;background-color:${CTA_GREEN};color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;letter-spacing:0.01em;border-radius:10px;font-family:${FONT};">Set Your Password</a>
              </td></tr></table>
            </td></tr>
            ${ctaNote ? `<tr><td align="center" style="padding:10px 0 8px;">
              <p style="margin:0;font-size:12px;color:${TEXT_MUTED};font-family:${FONT};">${escapeHtml(ctaNote)}</p>
            </td></tr>` : ""}
          </table>

          <p style="margin:18px 0 40px;font-size:13px;line-height:1.6;color:${TEXT_MUTED};font-family:${FONT};">Once you're in, you can complete your profile, set your Communications Center preferences, and start receiving opportunities from the network.</p>
        </td></tr>

        <!-- Footer -->
        <tr><td align="center" style="background-color:${NAVY};border-radius:0 0 14px 14px;padding:24px 40px;">
          ${footerAgent ? renderFounderFooter(footerAgent) : `<img src="${MONOGRAM_URL}" width="22" height="22" alt="" style="display:block;margin:0 auto 10px;border:0;outline:none;text-decoration:none;" /><p style="margin:0 0 4px;font-size:13px;font-weight:600;letter-spacing:0.02em;color:#ffffff;font-family:${FONT};">By Agents. For Agents. All Agents.</p><p style="margin:0;font-size:11px;color:rgba(255,255,255,0.55);font-family:${FONT};">All Agent Connect</p>`}
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
