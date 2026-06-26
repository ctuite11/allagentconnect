/* ------------------------------------------------------------------ */
/*  Agent Forward Invitation — premium platform overview email        */
/*  Stand-alone HTML; no sender/Founding Member references.           */
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

const GROW = [
  "Generate seller and buyer opportunities.",
  "Add and manage your listings.",
  "Share listings with buyers, clients, and other agents.",
  "Search private, off-market, coming soon, and on-market listings.",
  "Create personalized buyer Hot Sheets.",
  "Receive instant notifications when matching listings become available.",
  "Match buyers with listings more efficiently.",
  "Send and receive referrals.",
  "Message agents directly within the platform.",
  "Share listings to social media with professional property previews.",
  "Manage your contacts, conversations, listings, and activity from one dashboard.",
];

const NETWORK = [
  "Connect with verified real estate professionals.",
  "Build trusted referral relationships.",
  "Collaborate with agents across Massachusetts.",
  "Expand your reach and grow your business.",
];

const MEMBERSHIP = [
  "Free for a limited time.",
  "Exclusively for licensed real estate professionals.",
  "Secure verification helps maintain a trusted professional community.",
];

function renderBullets(items: string[]): string {
  return items
    .map(
      (label) => `<tr><td style="padding:0 0 12px;vertical-align:top;">
        <table role="presentation" cellspacing="0" cellpadding="0" width="100%"><tr>
          <td valign="top" width="22" style="padding:3px 10px 0 0;">
            <div style="width:8px;height:8px;border-radius:2px;background-color:${EMERALD_ACCENT};"></div>
          </td>
          <td style="font-size:15px;line-height:1.55;color:${TEXT_BODY};font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">${escapeHtml(label)}</td>
        </tr></table>
      </td></tr>`,
    )
    .join("");
}

function renderSection(title: string, items: string[]): string {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 28px;">
    <tr><td style="padding:0 0 14px;">
      <h2 style="margin:0;font-size:18px;font-weight:700;letter-spacing:-0.01em;color:${TEXT_DARK};font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">${escapeHtml(title)}</h2>
      <div style="width:32px;height:2px;background-color:${EMERALD_ACCENT};margin:8px 0 0;border-radius:1px;"></div>
    </td></tr>
    <tr><td>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        ${renderBullets(items)}
      </table>
    </td></tr>
  </table>`;
}

export interface AgentForwardEmailOptions {
  ctaUrl: string;
  preheader?: string;
}

export function buildAgentForwardEmailHtml(opts: AgentForwardEmailOptions): string {
  const { ctaUrl } = opts;
  const preheader =
    opts.preheader ??
    "A professional platform built exclusively for licensed real estate agents.";

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
    <tr><td align="center" style="padding:32px 16px 48px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;">

        <!-- Header -->
        <tr><td align="center" style="background-color:${NAVY};border-radius:14px 14px 0 0;padding:36px 40px 28px;">
          <img src="${MONOGRAM_URL}" width="44" height="44" alt="All Agent Connect" style="display:block;margin:0 auto;border:0;outline:none;text-decoration:none;" />
          <p style="margin:14px 0 0;font-size:18px;font-weight:600;letter-spacing:-0.02em;color:#ffffff;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">All Agent Connect</p>
          <div style="width:48px;height:2px;background-color:${EMERALD_ACCENT};margin:18px auto 22px;border-radius:1px;"></div>
          <h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;font-weight:700;letter-spacing:-0.02em;color:#ffffff;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Everything you need to grow your real estate business&mdash;all in one platform.</h1>
          <p style="margin:0;font-size:14px;line-height:1.55;color:rgba(255,255,255,0.72);font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">A professional platform built exclusively for licensed real estate agents.</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="background-color:#ffffff;border:1px solid ${BORDER};border-top:none;padding:36px 40px 8px;">
          ${renderSection("Grow Your Business", GROW)}
          ${renderSection("Build Your Professional Network", NETWORK)}
          ${renderSection("Membership", MEMBERSHIP)}

          <!-- CTA -->
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:8px 0 4px;">
            <tr><td align="center" style="padding:8px 0 6px;">
              <table role="presentation" cellspacing="0" cellpadding="0"><tr><td align="center" bgcolor="${CTA_GREEN}" style="border-radius:10px;">
                <a href="${ctaUrl}" target="_blank" style="display:inline-block;padding:15px 34px;background-color:${CTA_GREEN};color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;letter-spacing:0.01em;border-radius:10px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Create Your Free Account</a>
              </td></tr></table>
            </td></tr>
            <tr><td align="center" style="padding:10px 0 24px;">
              <p style="margin:0;font-size:12px;color:${TEXT_MUTED};font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Free for a limited time.</p>
            </td></tr>
          </table>
        </td></tr>

        <!-- Footer -->
        <tr><td align="center" style="background-color:${NAVY};border-top:2px solid ${EMERALD_ACCENT};border-radius:0 0 14px 14px;padding:26px 40px 24px;">
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
