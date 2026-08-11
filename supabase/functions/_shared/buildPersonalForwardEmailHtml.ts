/* ------------------------------------------------------------------ */
/*  Personal Forward Invitation — matches the new Join Invitation     */
/*  design (centered AAC logo, centered H1, bullets, blue CTA,        */
/*  Chris Tuite / Founder signature). Used for the "forward from my   */
/*  personal inbox" admin tool.                                       */
/* ------------------------------------------------------------------ */

const AAC_LOGO_URL =
  "https://allagentconnect.com/email/aac-monogram-green-128.png";

export const PERSONAL_FORWARD_H1 =
  "You\u2019re invited to join All Agent Connect";

export interface PersonalForwardEmailOptions {
  /** Full URL for the CTA button (already resolved by the caller). */
  ctaUrl: string;
  /** Optional short preheader text (hidden inbox preview). */
  preheader?: string;
}

const BULLETS = [
  "Seller and buyer leads",
  "Buyer and renter needs from other agents",
  "Off-market and coming-soon listings",
  "Instant alerts on new listing activity",
  "Referrals and agent-to-agent opportunities",
  "Direct connections with verified agents",
  "Free for a limited time, licensed agents only",
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
    <tr><td align="center" style="padding:40px 16px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;">

        <!-- Dark navy branded header -->
        <tr><td align="center" style="background-color:#111317;border-radius:12px 12px 0 0;padding:32px 40px 0;">
          <img src="${AAC_LOGO_URL}" width="40" height="40" alt="All Agent Connect" style="display:block;border:0;outline:none;text-decoration:none;" />
          <p style="margin:12px 0 0;font-size:18px;font-weight:600;letter-spacing:-0.02em;color:#ffffff;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">All Agent Connect</p>
          <div style="width:48px;height:2px;background-color:#50c878;margin:16px auto 0;border-radius:1px;"></div>
          <div style="height:24px;"></div>
        </td></tr>

        <!-- White content body -->
        <tr><td style="background-color:#ffffff;border:1px solid #d1d5db;border-top:none;padding:32px 40px 36px;">
          <h1 style="margin:0 0 24px;font-size:24px;font-weight:700;line-height:1.25;color:#0f172a;text-align:center;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">${PERSONAL_FORWARD_H1}</h1>
          <p style="margin:0 0 14px;font-size:14px;line-height:1.65;color:#0f172a;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Hi there,</p>
          <p style="margin:0 0 14px;font-size:14px;line-height:1.65;color:#334155;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">You&rsquo;re already in the Facebook agent groups &mdash; now let&rsquo;s step it up.</p>
          <p style="margin:0 0 14px;font-size:14px;line-height:1.65;color:#334155;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">I&rsquo;d like to invite you to <strong>All Agent Connect</strong> &mdash; a private network built for real estate agents. Here&rsquo;s what you get:</p>
          <div style="margin:0 0 16px;">
            ${bulletHtml}
          </div>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            <tr><td align="center" style="padding:28px 0 0;">
              <a href="${ctaUrl}" style="display:inline-block;padding:14px 28px;background:#0E56F5;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;border-radius:8px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Create your account &rarr;</a>
            </td></tr>
          </table>
          <p style="margin:32px 0 4px;font-size:14px;color:#0f172a;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Thanks,</p>
          <p style="margin:0 0 4px;font-size:14px;color:#0f172a;font-weight:600;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Chris Tuite</p>
          <p style="margin:0;font-size:13px;color:#64748b;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Founder, All Agent Connect</p>
        </td></tr>

        <!-- Dark footer -->
        <tr><td align="center" style="background-color:#111317;border-top:2px solid #50c878;border-radius:0 0 12px 12px;padding:24px 40px 20px;text-align:center;">
          <img src="${AAC_LOGO_URL}" width="24" height="24" alt="All Agent Connect" style="display:block;margin:0 auto 12px;border:0;outline:none;text-decoration:none;" />
          <p style="margin:0 0 4px;font-size:12px;color:rgba(255,255,255,0.6);font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">All Agent Connect</p>
          <p style="margin:0 0 6px;font-size:12px;color:rgba(255,255,255,0.45);font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
            <a href="mailto:chris@allagentconnect.com" style="color:rgba(255,255,255,0.45);text-decoration:none;">chris@allagentconnect.com</a>
          </p>
          <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.35);font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
            <a href="mailto:chris@allagentconnect.com?subject=Remove%20My%20Account&body=Please%20remove%20my%20account." style="color:rgba(255,255,255,0.35);text-decoration:underline;">Remove my account</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}