/* ------------------------------------------------------------------ */
/*  Concierge listing review email (AAC prepared a draft FOR a member)  */
/*  New template. Does not modify any existing email builder.           */
/* ------------------------------------------------------------------ */

function escapeHtml(s: unknown): string {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const NAVY = "#111317";
const EMERALD_ACCENT = "#50c878";
const CTA_GREEN = "#16A34A";
const PRIMARY_BLUE = "#0E56F5";
const TEXT_DARK = "#0f172a";
const TEXT_BODY = "#334155";
const BORDER = "#e5e7eb";
const MONOGRAM_URL = "https://allagentconnect.com/email/aac-monogram-green-128.png";

export interface ConciergeReviewEmailOptions {
  agentName?: string | null;
  /** Street line, e.g. "12 Beacon St, Unit 4". */
  addressLine: string;
  /** City, ST ZIP. */
  cityLine?: string | null;
  priceLabel: string;
  statusLabel: string;
  photoUrl?: string | null;
  beds?: number | null;
  baths?: number | null;
  sqft?: number | null;
  propertyType?: string | null;
  description?: string | null;
  reviewUrl: string;
  editUrl: string;
  expiresLabel: string;
  preheader?: string;
}

function factRow(label: string, value: string): string {
  return `<span style="display:inline-block;margin:0 14px 6px 0;font-size:13.5px;color:${TEXT_BODY};font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;"><span style="color:#737373;font-weight:500;">${escapeHtml(label)}</span> <strong style="color:${TEXT_DARK};">${escapeHtml(value)}</strong></span>`;
}

function ctaButton(url: string, label: string, color: string): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" width="100%"><tr><td align="center" bgcolor="${color}" style="border-radius:10px;">
    <a href="${url}" target="_blank" style="display:block;padding:15px 20px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;border-radius:10px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">${escapeHtml(label)}</a>
  </td></tr></table>`;
}

export function buildConciergeReviewEmailHtml(opts: ConciergeReviewEmailOptions): string {
  const preheader = opts.preheader ??
    `We prepared this listing for you: ${opts.addressLine}. Review it, then publish or edit.`;
  const greeting = opts.agentName ? `Hi ${escapeHtml(opts.agentName)},` : "Hi there,";

  const facts: string[] = [];
  if (typeof opts.beds === "number" && opts.beds > 0) facts.push(factRow("Beds", String(opts.beds)));
  if (typeof opts.baths === "number" && opts.baths > 0) facts.push(factRow("Baths", String(opts.baths)));
  if (typeof opts.sqft === "number" && opts.sqft > 0) {
    facts.push(factRow("Sq Ft", Math.round(opts.sqft).toLocaleString()));
  }
  if (opts.propertyType) facts.push(factRow("Type", opts.propertyType));

  const photo = opts.photoUrl
    ? `<tr><td style="padding:0;"><img src="${opts.photoUrl}" width="600" alt="${escapeHtml(opts.addressLine)}" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;text-decoration:none;border-radius:12px 12px 0 0;" /></td></tr>`
    : "";

  const description = opts.description
    ? `<p style="margin:14px 0 0;font-size:14px;line-height:1.65;color:${TEXT_BODY};font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">${escapeHtml(
        opts.description.length > 420 ? `${opts.description.slice(0, 420).trim()}…` : opts.description,
      )}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>We prepared your listing — All Agent Connect</title>
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
          <h1 style="margin:0;font-size:26px;line-height:1.25;font-weight:700;letter-spacing:-0.02em;color:#ffffff;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">We prepared this listing for you</h1>
        </td></tr>

        <tr><td style="background-color:#ffffff;border:1px solid ${BORDER};border-top:none;border-radius:0 0 14px 14px;padding:32px 32px 36px;">
          <p style="margin:0 0 14px;font-size:16px;line-height:1.6;color:${TEXT_DARK};font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">${greeting}</p>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.65;color:${TEXT_BODY};font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">We prepared this listing for you. Review it below, then publish it as-is or make any changes first. Nothing goes live until you publish it yourself.</p>

          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid ${BORDER};border-radius:12px;overflow:hidden;">
            ${photo}
            <tr><td style="padding:20px 22px 22px;">
              <span style="display:inline-block;margin:0 0 12px;padding:5px 11px;border-radius:999px;background-color:#f1f5f9;color:${PRIMARY_BLUE};font-size:11.5px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">${escapeHtml(opts.statusLabel)}</span>
              <p style="margin:0 0 4px;font-size:24px;font-weight:700;letter-spacing:-0.02em;color:${TEXT_DARK};font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">${escapeHtml(opts.priceLabel)}</p>
              <p style="margin:0;font-size:15px;font-weight:600;color:${TEXT_DARK};font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">${escapeHtml(opts.addressLine)}</p>
              ${opts.cityLine ? `<p style="margin:2px 0 0;font-size:14px;color:#64748b;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">${escapeHtml(opts.cityLine)}</p>` : ""}
              ${facts.length ? `<p style="margin:14px 0 0;">${facts.join("")}</p>` : ""}
              ${description}
            </td></tr>
          </table>

          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:26px 0 0;">
            <tr><td style="padding:0 0 12px;">${ctaButton(opts.reviewUrl, "Review & Publish Listing", CTA_GREEN)}</td></tr>
            <tr><td>${ctaButton(opts.editUrl, "Edit / Update Listing", PRIMARY_BLUE)}</td></tr>
          </table>

          <p style="margin:20px 0 0;font-size:12.5px;line-height:1.6;color:#64748b;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Both buttons take you straight to this listing in your own account — nothing is published by opening this email. This link is valid until ${escapeHtml(opts.expiresLabel)} and can be used once.</p>
          <p style="margin:18px 0 0;font-size:10.5px;color:#94a3b8;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">All Agent Connect &middot; By Agents. For Agents. All Agents.</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
