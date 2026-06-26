/* ------------------------------------------------------------------ */
/*  License Verified — forwardable confirmation email                 */
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
const TEXT_MUTED = "#64748b";
const BORDER = "#e5e7eb";
const MONOGRAM_URL = "https://allagentconnect.com/email/aac-monogram-green-128.png";

const NEXT_STEPS = [
  "Complete your profile so other agents can find you.",
  "Add or import your listings.",
  "Start sharing listings and building buyer Hot Sheets.",
];

function renderBullets(items: string[]): string {
  return items
    .map(
      (label) => `<tr><td style="padding:0 0 12px;vertical-align:top;">
        <table role="presentation" cellspacing="0" cellpadding="0" width="100%"><tr>
          <td valign="top" width="18" style="padding:9px 10px 0 0;line-height:0;">
            <div style="width:6px;height:6px;border-radius:2px;background-color:${EMERALD_ACCENT};"></div>
          </td>
          <td valign="top" style="font-size:15px;line-height:1.55;color:${TEXT_BODY};font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">${escapeHtml(label)}</td>
        </tr></table>
      </td></tr>`,
    )
    .join("");
}

export interface LicenseVerifiedEmailOptions {
  ctaUrl: string;
  preheader?: string;
  agentName?: string | null;
}

export function buildLicenseVerifiedEmailHtml(opts: LicenseVerifiedEmailOptions): string {
  const { ctaUrl } = opts;
  const preheader =
    opts.preheader ??
    "Your license has been verified. Your All Agent Connect account is ready.";
  const greeting = opts.agentName
    ? `Congratulations, ${escapeHtml(opts.agentName)} — your real estate license has been verified.`
    : "Congratulations — your real estate license has been verified.";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>License Verified — All Agent Connect</title>
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
          <h1 style="margin:0 0 12px;font-size:26px;line-height:1.25;font-weight:700;letter-spacing:-0.02em;color:#ffffff;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Your license has been verified</h1>
          <p style="margin:0;font-size:14px;line-height:1.55;color:rgba(255,255,255,0.72);font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Your account is approved and ready to use.</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="background-color:#ffffff;border:1px solid ${BORDER};border-top:none;padding:36px 40px 8px;">
          <p style="margin:0 0 18px;font-size:16px;line-height:1.6;color:${TEXT_DARK};font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">${greeting}</p>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.65;color:${TEXT_BODY};font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">You now have full access to All Agent Connect — the professional platform built exclusively for licensed real estate agents. Log in to get started.</p>

          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;">
            <tr><td style="padding:0 0 14px;">
              <h2 style="margin:0;font-size:18px;font-weight:700;letter-spacing:-0.01em;color:${TEXT_DARK};font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">What's next</h2>
              <div style="width:32px;height:2px;background-color:${EMERALD_ACCENT};margin:8px 0 0;border-radius:1px;"></div>
            </td></tr>
            <tr><td>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                ${renderBullets(NEXT_STEPS)}
              </table>
            </td></tr>
          </table>

          <!-- CTA -->
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:8px 0 4px;">
            <tr><td align="center" style="padding:8px 0 6px;">
              <table role="presentation" cellspacing="0" cellpadding="0"><tr><td align="center" bgcolor="${CTA_GREEN}" style="border-radius:10px;">
                <a href="${ctaUrl}" target="_blank" style="display:inline-block;padding:15px 34px;background-color:${CTA_GREEN};color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;letter-spacing:0.01em;border-radius:10px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Log In to All Agent Connect</a>
              </td></tr></table>
            </td></tr>
            <tr><td align="center" style="padding:10px 0 24px;">
              <p style="margin:0;font-size:12px;color:${TEXT_MUTED};font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Welcome to the network.</p>
            </td></tr>
          </table>
        </td></tr>

        <!-- Footer -->
        <tr><td align="center" style="background-color:${NAVY};border-top:2px solid ${EMERALD_ACCENT};border-radius:0 0 14px 14px;padding:26px 40px 26px;">
          <img src="${MONOGRAM_URL}" width="22" height="22" alt="" style="display:block;margin:0 auto 10px;border:0;outline:none;text-decoration:none;" />
          <p style="margin:0 0 4px;font-size:13px;font-weight:600;letter-spacing:0.02em;color:#ffffff;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">By Agents. For Agents. All Agents.</p>
          <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.55);font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">All Agent Connect</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
