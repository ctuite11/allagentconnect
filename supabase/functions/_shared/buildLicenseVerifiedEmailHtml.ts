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
const EMERALD_PANEL_BG = "#f0fdf6";
const EMERALD_PANEL_BORDER = "#bbf7d0";
const MONOGRAM_URL = "https://allagentconnect.com/email/aac-monogram-green-256.png";

const NEXT_STEPS = [
  "Open the Comms Center to post needs, discover opportunities, and connect with verified agents.",
  "Complete your profile so other agents can find you.",
  "Add or import your listings.",
  "Start sharing listings and building buyer Hot Sheets.",
];

/**
 * Monogram with an email-safe fallback: styled ALT text renders in Outlook and
 * in any client that blocks images, so the navy header is never blank.
 */
function renderMonogram(size: number): string {
  return `<img src="${MONOGRAM_URL}" width="${size}" height="${size}" alt="AAC" style="display:block;margin:0 auto;border:0;outline:none;text-decoration:none;color:${EMERALD_ACCENT};font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:${Math.round(size * 0.42)}px;font-weight:700;line-height:${size}px;text-align:center;" />`;
}

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
  footerAgent?: FooterAgent | null;
  /** Overrides the CTA button label (activation flow uses "Activate My Account"). */
  ctaLabel?: string;
  /** Small line under the CTA, e.g. the activation link expiry. */
  ctaNote?: string;
}

export interface FooterAgent {
  firstName?: string | null;
  lastName?: string | null;
  title?: string | null;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  headshotUrl?: string | null;
  websiteUrl?: string | null;
}

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
  if (agent.company) {
    lines.push(`<p style="margin:2px 0 0;font-size:12px;color:rgba(255,255,255,0.72);font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">${escapeHtml(agent.company)}</p>`);
  }
  const contactParts: string[] = [];
  if (agent.phone) {
    contactParts.push(`<a href="tel:${escapeHtml(agent.phone.replace(/[^0-9+]/g, ""))}" style="color:#fff;text-decoration:none;">${escapeHtml(formatPhone(agent.phone))}</a>`);
  }
  if (agent.email) {
    contactParts.push(`<a href="mailto:${escapeHtml(agent.email)}" style="color:#fff;text-decoration:none;">${escapeHtml(agent.email)}</a>`);
  }
  if (agent.websiteUrl) {
    const display = agent.websiteUrl.replace(/^https?:\/\//, "");
    const href = agent.websiteUrl.startsWith("http") ? agent.websiteUrl : `https://${agent.websiteUrl}`;
    contactParts.push(`<a href="${escapeHtml(href)}" style="color:#fff;text-decoration:none;">${escapeHtml(display)}</a>`);
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

export function buildLicenseVerifiedEmailHtml(opts: LicenseVerifiedEmailOptions): string {
  const { ctaUrl, footerAgent } = opts;
  const ctaLabel = opts.ctaLabel?.trim() || "Log In to All Agent Connect";
  const ctaNote = opts.ctaNote?.trim() || "Welcome to the network.";
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
        <tr><td align="center" bgcolor="${NAVY}" style="background-color:${NAVY};border-radius:14px 14px 0 0;padding:36px 40px 28px;">
          ${renderMonogram(48)}
          <p style="margin:14px 0 0;font-size:18px;font-weight:600;letter-spacing:-0.02em;color:#ffffff;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">All Agent Connect</p>
          <div style="width:48px;height:2px;background-color:${EMERALD_ACCENT};margin:18px auto 22px;border-radius:1px;"></div>
          <h1 style="margin:0 0 12px;font-size:26px;line-height:1.25;font-weight:700;letter-spacing:-0.02em;color:#ffffff;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Your license has been verified</h1>
          <p style="margin:0;font-size:14px;line-height:1.55;color:rgba(255,255,255,0.72);font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Your account is approved and ready to use.</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="background-color:#ffffff;border:1px solid ${BORDER};border-top:none;padding:36px 40px 8px;">
          <p style="margin:0 0 18px;font-size:16px;line-height:1.6;color:${TEXT_DARK};font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">${greeting}</p>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.65;color:${TEXT_BODY};font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">You now have full access to All Agent Connect — the professional platform built exclusively for licensed real estate agents. Log in to get started.</p>

          <!-- Comms Center feature panel -->
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 26px;">
            <tr><td bgcolor="${EMERALD_PANEL_BG}" style="background-color:${EMERALD_PANEL_BG};border:1px solid ${EMERALD_PANEL_BORDER};border-left:4px solid ${EMERALD_ACCENT};border-radius:10px;padding:20px 22px;">
              <h2 style="margin:0 0 8px;font-size:17px;font-weight:700;letter-spacing:-0.01em;color:${TEXT_DARK};font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Start with the Comms Center</h2>
              <p style="margin:0 0 10px;font-size:14.5px;line-height:1.6;color:${TEXT_BODY};font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Post buyer and seller needs, see opportunities shared by verified agents, and start direct conversations — all in one place.</p>
              <p style="margin:0;font-size:13px;line-height:1.55;color:${TEXT_MUTED};font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Once your account is activated, the Comms Center is the fastest way to plug into the AAC network.</p>
            </td></tr>
          </table>

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
                <a href="${ctaUrl}" target="_blank" style="display:inline-block;padding:15px 34px;background-color:${CTA_GREEN};color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;letter-spacing:0.01em;border-radius:10px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">${escapeHtml(ctaLabel)}</a>
              </td></tr></table>
            </td></tr>
            <tr><td align="center" style="padding:10px 0 44px;">
              <p style="margin:0;font-size:12px;color:${TEXT_MUTED};font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">${escapeHtml(ctaNote)}</p>
            </td></tr>
          </table>
        </td></tr>

        <!-- Footer -->
        <tr><td align="center" bgcolor="${NAVY}" style="background-color:${NAVY};border-radius:0 0 14px 14px;padding:26px 40px 26px;">
          ${footerAgent ? renderAgentFooter(footerAgent) : `<div style="margin:0 0 10px;">${renderMonogram(24)}</div><p style="margin:0 0 4px;font-size:13px;font-weight:600;letter-spacing:0.02em;color:#ffffff;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">By Agents. For Agents. All Agents.</p><p style="margin:0;font-size:11px;color:rgba(255,255,255,0.55);font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">All Agent Connect</p>`}
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
