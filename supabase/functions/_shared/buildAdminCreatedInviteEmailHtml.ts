/* ------------------------------------------------------------------ */
/*  Admin-Created Agent — personal setup invite from Chris            */
/*  Reuses License Verified visual shell but with permission-based    */
/*  copy explaining the account was pre-created for a Facebook        */
/*  community member. NOT a replacement for License Verified.         */
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

function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 11 && d.startsWith("1")) return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return raw;
}

function renderAgentFooter(agent: FooterAgent): string {
  const fullName = [agent.firstName, agent.lastName].filter(Boolean).join(" ").trim();
  const initials = [agent.firstName, agent.lastName]
    .filter(Boolean)
    .map((p) => (p as string).trim()[0]?.toUpperCase() ?? "")
    .join("");
  const avatarCell = agent.headshotUrl
    ? `<img src="${escapeHtml(agent.headshotUrl)}" width="104" height="104" alt="${escapeHtml(fullName)}" style="display:block;width:104px;height:104px;border-radius:50%;object-fit:cover;border:1px solid ${EMERALD_ACCENT};" />`
    : `<div style="width:104px;height:104px;border-radius:50%;background:${EMERALD_ACCENT};color:#fff;font-weight:700;font-size:34px;line-height:104px;text-align:center;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">${escapeHtml(initials || "AA")}</div>`;

  const lines: string[] = [];
  if (fullName) {
    lines.push(`<p style="margin:0;font-size:16px;font-weight:700;color:#fff;letter-spacing:-0.01em;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">${escapeHtml(fullName)}</p>`);
  }
  if (agent.title) {
    lines.push(`<p style="margin:2px 0 0;font-size:12px;color:rgba(255,255,255,0.72);font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">${escapeHtml(agent.title)}</p>`);
  }
  const contactParts: string[] = [];
  if (agent.phone) {
    contactParts.push(`<a href="tel:${escapeHtml(agent.phone.replace(/[^0-9+]/g, ""))}" style="color:#fff;text-decoration:none;">${escapeHtml(formatPhone(agent.phone))}</a>`);
  }
  if (agent.email) {
    contactParts.push(`<a href="mailto:${escapeHtml(agent.email)}" style="color:#fff;text-decoration:none;">${escapeHtml(agent.email)}</a>`);
  }
  if (contactParts.length) {
    lines.push(`<p style="margin:8px 0 0;font-size:12.5px;color:#fff;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">${contactParts.join(' &nbsp;·&nbsp; ')}</p>`);
  }

  return `<table role="presentation" cellspacing="0" cellpadding="0" align="center"><tr>
    <td valign="middle" style="padding-right:18px;">${avatarCell}</td>
    <td valign="middle" align="left">${lines.join("")}</td>
  </tr></table>
  <p style="margin:18px 0 0;font-size:10.5px;color:rgba(255,255,255,0.45);font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">All Agent Connect &middot; By Agents. For Agents. All Agents.</p>`;
}

export interface AdminCreatedInviteEmailOptions {
  ctaUrl: string;
  firstName?: string | null;
  preheader?: string;
  footerAgent?: FooterAgent | null;
}

export function buildAdminCreatedInviteEmailHtml(opts: AdminCreatedInviteEmailOptions): string {
  const { ctaUrl, footerAgent } = opts;
  const first = opts.firstName?.trim();
  const greetingName = first ? escapeHtml(first) : "there";
  const preheader =
    opts.preheader ??
    "A personal invitation from Chris Tuite. Activate whenever you're ready.";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Your All Agent Connect account is ready</title>
</head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#ffffff;">
    <tr><td align="center" style="padding:32px 16px 48px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;">

        <!-- Header -->
        <tr><td align="center" style="background-color:${NAVY};border-radius:14px 14px 0 0;padding:36px 40px 28px;">
          <img src="${MONOGRAM_URL}" width="44" height="44" alt="All Agent Connect" style="display:block;margin:0 auto;border:0;outline:none;text-decoration:none;" />
          <p style="margin:14px 0 0;font-size:18px;font-weight:600;letter-spacing:-0.02em;color:#ffffff;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">All Agent Connect</p>
          <div style="width:48px;height:2px;background-color:${EMERALD_ACCENT};margin:18px auto 22px;border-radius:1px;"></div>
          <h1 style="margin:0 0 12px;font-size:26px;line-height:1.25;font-weight:700;letter-spacing:-0.02em;color:#ffffff;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">A personal invitation from Chris</h1>
          <p style="margin:0;font-size:14px;line-height:1.55;color:rgba(255,255,255,0.72);font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">A personal note from Chris.</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="background-color:#ffffff;border:1px solid ${BORDER};border-top:none;padding:36px 40px 8px;">
          <p style="margin:0 0 18px;font-size:16px;line-height:1.6;color:${TEXT_DARK};font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Hi ${greetingName},</p>

          <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:${TEXT_BODY};font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Since you're already a member of the All Agent Connect Facebook community, we created your account so you wouldn't have to register from scratch.</p>

          <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:${TEXT_BODY};font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">If you'd like to activate your account, simply click the button below to create your password.</p>

          <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:${TEXT_BODY};font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">There's absolutely no obligation. If now isn't the right time, your account will be here whenever you're ready.</p>

          <p style="margin:0 0 24px;font-size:15px;line-height:1.65;color:${TEXT_BODY};font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">I appreciate your support of the All Agent Connect community and hope you'll join us on the platform.</p>

          <!-- CTA -->
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:8px 0 4px;">
            <tr><td align="center" style="padding:8px 0 6px;">
              <table role="presentation" cellspacing="0" cellpadding="0"><tr><td align="center" bgcolor="${CTA_GREEN}" style="border-radius:10px;">
                <a href="${ctaUrl}" target="_blank" style="display:inline-block;padding:15px 34px;background-color:${CTA_GREEN};color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;letter-spacing:0.01em;border-radius:10px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Activate My Account</a>
              </td></tr></table>
            </td></tr>
            <tr><td align="center" style="padding:14px 0 8px;">
              <p style="margin:0;font-size:13px;color:${TEXT_MUTED};font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Thanks,</p>
            </td></tr>
            <tr><td align="center" style="padding:0 0 40px;">
              <p style="margin:0;font-size:13px;color:${TEXT_DARK};font-weight:600;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Chris Tuite</p>
              <p style="margin:2px 0 0;font-size:12px;color:${TEXT_MUTED};font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Founder, All Agent Connect</p>
            </td></tr>
          </table>
        </td></tr>

        <!-- Footer -->
        <tr><td align="center" style="background-color:${NAVY};border-radius:0 0 14px 14px;padding:26px 40px 26px;">
          ${footerAgent ? renderAgentFooter(footerAgent) : `<img src="${MONOGRAM_URL}" width="22" height="22" alt="" style="display:block;margin:0 auto 10px;border:0;outline:none;text-decoration:none;" /><p style="margin:0 0 4px;font-size:13px;font-weight:600;letter-spacing:0.02em;color:#ffffff;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">By Agents. For Agents. All Agents.</p><p style="margin:0;font-size:11px;color:rgba(255,255,255,0.55);font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">All Agent Connect</p>`}
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}