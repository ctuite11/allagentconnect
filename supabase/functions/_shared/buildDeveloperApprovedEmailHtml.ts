/* ------------------------------------------------------------------ */
/*  Developer Account Approved — branded setup/activation email       */
/*  Dedicated Developer template. Never reuse the agent invite copy.  */
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

export interface DeveloperApprovedEmailOptions {
  ctaUrl: string;
  firstName?: string | null;
  preheader?: string;
  /** Small line under the CTA, e.g. the activation link expiry. */
  ctaNote?: string;
  footerAgent?: FooterAgent | null;
}

export function buildDeveloperApprovedEmailHtml(opts: DeveloperApprovedEmailOptions): string {
  const { ctaUrl, footerAgent } = opts;
  const first = opts.firstName?.trim();
  const greetingName = first ? escapeHtml(first) : "there";
  const preheader = opts.preheader ??
    "Your Developer account is approved. Set up your password to get started.";
  const ctaNote = opts.ctaNote?.trim() || "This setup link is valid for 7 days.";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Your Developer account is approved — All Agent Connect</title>
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
          <h1 style="margin:0 0 12px;font-size:26px;line-height:1.25;font-weight:700;letter-spacing:-0.02em;color:#ffffff;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Your Developer account is approved</h1>
          <p style="margin:0;font-size:14px;line-height:1.55;color:rgba(255,255,255,0.72);font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Set up your password to activate your workspace.</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="background-color:#ffffff;border:1px solid ${BORDER};border-top:none;padding:36px 40px 8px;">
          <p style="margin:0 0 18px;font-size:16px;line-height:1.6;color:${TEXT_DARK};font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Hi ${greetingName},</p>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:${TEXT_BODY};font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Your request for Developer access to All Agent Connect has been verified and approved.</p>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:${TEXT_BODY};font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Your Developer workspace is ready. Set up your password to activate your account and get started.</p>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.65;color:${TEXT_BODY};font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Once activated, you'll be able to manage your developments, including project details, images, floor plans, unit availability, documents and updates.</p>

          <!-- CTA -->
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:8px 0 4px;">
            <tr><td align="center" style="padding:8px 0 6px;">
              <table role="presentation" cellspacing="0" cellpadding="0"><tr><td align="center" bgcolor="${CTA_GREEN}" style="border-radius:10px;">
                <a href="${ctaUrl}" target="_blank" style="display:inline-block;padding:15px 34px;background-color:${CTA_GREEN};color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;letter-spacing:0.01em;border-radius:10px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Set Up Developer Account</a>
              </td></tr></table>
            </td></tr>
            <tr><td align="center" style="padding:10px 0 26px;">
              <p style="margin:0;font-size:12px;color:${TEXT_MUTED};font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">${escapeHtml(ctaNote)}</p>
            </td></tr>
          </table>

          <div style="height:1px;background-color:${BORDER};margin:0 0 22px;"></div>

          <p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:${TEXT_BODY};font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Welcome to All Agent Connect.</p>
          <p style="margin:0;font-size:15px;line-height:1.5;color:${TEXT_DARK};font-weight:600;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Chris Tuite</p>
          <p style="margin:2px 0 34px;font-size:13.5px;line-height:1.5;color:${TEXT_MUTED};font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Founder</p>
        </td></tr>

        <!-- Footer -->
        <tr><td align="center" style="background-color:${NAVY};border-radius:0 0 14px 14px;padding:26px 40px 26px;">
          <img src="${MONOGRAM_URL}" width="22" height="22" alt="" style="display:block;margin:0 auto 10px;border:0;outline:none;text-decoration:none;" />
          <p style="margin:0 0 4px;font-size:13px;font-weight:600;letter-spacing:0.02em;color:#ffffff;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">By Agents. For Agents. All Agents.</p>
          <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.55);font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">All Agent Connect${footerAgent?.email ? ` &middot; ${escapeHtml(footerAgent.email)}` : ""}</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
