/* ------------------------------------------------------------------ */
/*  Sign-in link email (AAC-owned, 7-day token)                        */
/*  New template. Does not modify any existing email builder.          */
/* ------------------------------------------------------------------ */

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
const BORDER = "#e5e7eb";
const MONOGRAM_URL = "https://allagentconnect.com/email/aac-monogram-green-128.png";

export interface LoginLinkEmailOptions {
  ctaUrl: string;
  agentName?: string | null;
  expiresLabel: string;
  preheader?: string;
}

export function buildLoginLinkEmailHtml(opts: LoginLinkEmailOptions): string {
  const preheader = opts.preheader ??
    "Your sign-in link for All Agent Connect. Valid for 30 days, single use.";
  const greeting = opts.agentName
    ? `Hi ${escapeHtml(opts.agentName)},`
    : "Hi there,";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Your sign-in link — All Agent Connect</title>
</head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#ffffff;">
    <tr><td align="center" style="padding:32px 16px 48px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;">

        <tr><td align="center" style="background-color:${NAVY};border-radius:14px 14px 0 0;padding:36px 40px 28px;">
          <img src="${MONOGRAM_URL}" width="44" height="44" alt="All Agent Connect" style="display:block;margin:0 auto;border:0;outline:none;text-decoration:none;" />
          <p style="margin:14px 0 0;font-size:18px;font-weight:600;letter-spacing:-0.02em;color:#ffffff;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">All Agent Connect</p>
          <div style="width:48px;height:2px;background-color:${EMERALD_ACCENT};margin:18px auto 22px;border-radius:1px;"></div>
          <h1 style="margin:0;font-size:26px;line-height:1.25;font-weight:700;letter-spacing:-0.02em;color:#ffffff;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Your sign-in link</h1>
        </td></tr>

        <tr><td style="background-color:#ffffff;border:1px solid ${BORDER};border-top:none;border-radius:0 0 14px 14px;padding:36px 40px 40px;">
          <p style="margin:0 0 18px;font-size:16px;line-height:1.6;color:${TEXT_DARK};font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">${greeting}</p>
          <p style="margin:0 0 26px;font-size:15px;line-height:1.65;color:${TEXT_BODY};font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Use the button below to sign in to your All Agent Connect account. No password needed — you can set or change your password once you're in.</p>

          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            <tr><td align="center" style="padding:0 0 14px;">
              <table role="presentation" cellspacing="0" cellpadding="0"><tr><td align="center" bgcolor="${CTA_GREEN}" style="border-radius:10px;">
                <a href="${opts.ctaUrl}" target="_blank" style="display:inline-block;padding:15px 34px;background-color:${CTA_GREEN};color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;letter-spacing:0.01em;border-radius:10px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Sign In</a>
              </td></tr></table>
            </td></tr>
            <tr><td align="center">
              <p style="margin:0;font-size:12.5px;line-height:1.6;color:#64748b;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">This link is valid until ${escapeHtml(opts.expiresLabel)} and can be used once.</p>
            </td></tr>
          </table>

          <p style="margin:26px 0 0;font-size:12.5px;line-height:1.6;color:#64748b;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">If you didn't request this, you can safely ignore this email — nothing changes until the link is used.</p>
          <p style="margin:18px 0 0;font-size:10.5px;color:#94a3b8;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">All Agent Connect &middot; By Agents. For Agents. All Agents.</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
