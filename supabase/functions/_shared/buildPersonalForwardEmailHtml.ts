/* ------------------------------------------------------------------ */
/*  Personal Forward Invitation — matches the new Join Invitation     */
/*  design (centered AAC logo, centered H1, bullets, blue CTA,        */
/*  Chris Tuite / Founder signature). Used for the "forward from my   */
/*  personal inbox" admin tool.                                       */
/* ------------------------------------------------------------------ */

const AAC_LOGO_URL =
  "https://allagentconnect.com/email/aac-monogram-green-128.png";

export const PERSONAL_FORWARD_H1 =
  "Why pay for a network when you can launch one for free?";

export interface PersonalForwardEmailOptions {
  /** Full URL for the CTA button (already resolved by the caller). */
  ctaUrl: string;
  /** Optional short preheader text (hidden inbox preview). */
  preheader?: string;
}

const BULLETS = [
  "Seller leads",
  "Buyer leads",
  "Buyer and renter needs",
  "Off-market and coming-soon listings",
  "New listing activity",
  "Referrals and agent-to-agent opportunities",
  "Direct connections with verified agents",
];

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildPersonalForwardEmailHtml(
  opts: PersonalForwardEmailOptions,
): string {
  const { ctaUrl } = opts;
  const preheader =
    opts.preheader ??
    "A private network built for real estate agents — a personal invitation from Chris Tuite.";

  const bulletHtml = BULLETS.map(
    (b) =>
      `<p style="margin:0 0 8px 18px;text-indent:-14px;font-size:14px;line-height:1.6;color:#0f172a;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;"><span style="color:#64748b;">&bull;</span>&nbsp;&nbsp;${escapeHtml(b)}</p>`,
  ).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>All Agent Connect</title>
</head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#ffffff;">
    <tr><td align="center" style="padding:40px 16px 48px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;">
        <tr><td align="center" style="padding:0 0 24px;">
          <img src="${AAC_LOGO_URL}" alt="All Agent Connect" height="36" style="display:block;height:36px;width:auto;border:0;outline:none;" />
        </td></tr>
        <tr><td align="center" style="padding:0 0 20px;">
          <h1 style="margin:0;font-size:24px;font-weight:700;line-height:1.25;color:#0f172a;text-align:center;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">${PERSONAL_FORWARD_H1}</h1>
        </td></tr>
        <tr><td style="padding:0 0 16px;">
          <p style="margin:0 0 14px;font-size:14px;line-height:1.65;color:#0f172a;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Hi there,</p>
          <p style="margin:0 0 14px;font-size:14px;line-height:1.65;color:#334155;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">I&rsquo;d like to invite you to join <strong>All Agent Connect</strong>, a private network built for real estate agents.</p>
          <p style="margin:0 0 14px;font-size:14px;line-height:1.65;color:#334155;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">AAC helps agents connect around opportunities that often happen before they reach the public market, including:</p>
          <div style="margin:0 0 16px;">
            ${bulletHtml}
          </div>
          <p style="margin:0;font-size:14px;line-height:1.65;color:#334155;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">The goal is simple: give agents one place to see more demand, more listings, and more opportunities from across the network.</p>
        </td></tr>
        <tr><td align="center" style="padding:28px 0 0;">
          <a href="${ctaUrl}" style="display:inline-block;padding:14px 28px;background:#0E56F5;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;border-radius:8px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Create your account &rarr;</a>
        </td></tr>
        <tr><td style="padding:32px 0 0;">
          <p style="margin:0 0 4px;font-size:14px;color:#0f172a;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Thanks,</p>
          <p style="margin:0 0 4px;font-size:14px;color:#0f172a;font-weight:600;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Chris Tuite</p>
          <p style="margin:0;font-size:13px;color:#64748b;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Founder, All Agent Connect</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}