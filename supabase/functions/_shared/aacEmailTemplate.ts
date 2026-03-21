/* ------------------------------------------------------------------ */
/*  Unified AAC email template — single source of truth               */
/*  All edge-function emails route through buildAacEmail()            */
/* ------------------------------------------------------------------ */

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

interface AacEmailOptions {
  headline: string;
  /** Already-assembled HTML body content (paragraphs, tables, etc.) */
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
  /** Hidden preheader text shown in inbox preview */
  preheader?: string;
}

// Inline SVG monogram — white paths on blue circle
const LOGO_SVG = `<table role="presentation" cellspacing="0" cellpadding="0"><tr><td align="center">
<div style="width:48px;height:48px;border-radius:50%;background-color:#0E56F5;display:inline-block;vertical-align:middle;text-align:center;line-height:48px;">
<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" style="width:48px;height:48px;" arcsize="50%" fill="true" stroke="false"><v:fill color="#0E56F5"/><![endif]-->
<svg width="28" height="28" viewBox="0 0 1024 1024" style="vertical-align:middle;margin-top:10px;" xmlns="http://www.w3.org/2000/svg">
<path transform="translate(502,77)" d="m0 0h22l10 3 9 5 10 9 238 238 8 7 14 15 5 4 7 8 12 12 9 10 7 14 5 17 1 6v449l-4 16-5 13-7 11-9 10-9 8-14 8-12 5-14 3h-329l-18-4-16-7-12-9-9-9-7-10-7-14-4-13-2-12v-248l4-16 6-11 9-10 11-7 11-4 15-2h206l1 1v50l-3 16-6 15-7 12-11 12-9 8-11 7-15 6-14 3-13 1h-24l-10 3-4 2-2 4-2 5v86l5 10 7 4 4 1h182l8-3 6-7 1-3v-324l-3-16-5-13-8-14-6-8-8-7-8-9-8-7-38-38-4-5-8-7-14-15-81-81v-2l-4-2-8-6-8-2h-7l-9 3-10 9-136 136-15 16-10 9-10 11-8 13-7 15-4 16-1 8v335l-2 20-4 17-6 16-9 16-9 12-12 13-14 11-13 8-13 6-15 5-14 3-10 1h-11v-526l4-16 8-16 6-8 253-253 5-6h2l2-4 32-32 10-6 9-3z" fill="#FFFFFF"/>
<path transform="translate(436,572)" d="m0 0h207l1 1v50l-3 16-6 15-7 12-11 12-9 8-11 7-15 6-14 3-13 1h-24l-10 3-4 2-2 4-2 5v86l5 10 7 4 4 1h182l8-3 6-7h1v45l-3 15-6 16-8 15-13 16-7 7-16 11-15 7-18 6h-2v2h-182l-18-4-16-7-12-9-9-9-7-10-7-14-4-13-2-12v-248l4-16 6-11 9-10 11-7 11-4z" fill="#FFFFFF"/>
</svg>
<!--[if mso]></v:roundrect><![endif]-->
</div>
</td></tr></table>`;

export function buildAacEmail(opts: AacEmailOptions): string {
  const { headline, body, ctaLabel, ctaUrl, preheader } = opts;

  const preheaderHtml = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(preheader)}</div>`
    : "";

  const ctaHtml =
    ctaLabel && ctaUrl
      ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr><td align="center" style="padding:28px 0 0;">
            <a href="${ctaUrl}" target="_blank" style="display:inline-block;padding:14px 28px;background-color:#0E56F5;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;border-radius:8px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">${escapeHtml(ctaLabel)}</a>
          </td></tr>
        </table>`
      : "";

  const fallbackHtml = ctaUrl
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr><td style="padding:16px 0 0;">
          <p style="margin:0 0 4px;font-size:12px;color:#94a3b8;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">If the button doesn&rsquo;t work, copy this link:</p>
          <div style="background-color:#f8fafc;padding:10px 12px;border-radius:6px;">
            <p style="margin:0;font-size:11px;color:#475569;word-break:break-all;font-family:'SF Mono',Monaco,'Courier New',monospace;">${escapeHtml(ctaUrl)}</p>
          </div>
        </td></tr>
      </table>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>${escapeHtml(headline)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
  ${preheaderHtml}
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f8fafc;">
    <tr><td align="center" style="padding:40px 16px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background-color:#ffffff;border-radius:12px;border:1px solid #e2e8f0;">

        <!-- Logo + Wordmark -->
        <tr><td align="center" style="padding:32px 40px 20px;">
          ${LOGO_SVG}
          <p style="margin:12px 0 0;font-size:20px;font-weight:600;letter-spacing:-0.02em;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
            <span style="color:#0E56F5;">All Agent </span><span style="color:#94A3B8;">Connect</span>
          </p>
          <div style="width:48px;height:2px;background-color:#0E56F5;margin:14px auto 0;border-radius:1px;"></div>
        </td></tr>

        <!-- Content -->
        <tr><td style="padding:8px 40px 32px;">
          <h2 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#0f172a;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">${escapeHtml(headline)}</h2>
          <div style="font-size:15px;line-height:1.6;color:#334155;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
            ${body}
          </div>
          ${ctaHtml}
          ${fallbackHtml}
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:20px 40px;border-top:1px solid #e2e8f0;text-align:center;">
          <p style="margin:0 0 4px;font-size:12px;color:#94a3b8;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">All Agent Connect</p>
          <p style="margin:0 0 6px;font-size:12px;color:#94a3b8;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
            <a href="mailto:hello@allagentconnect.com" style="color:#94a3b8;text-decoration:none;">hello@allagentconnect.com</a>
          </p>
          <p style="margin:0;font-size:11px;color:#94a3b8;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
            <a href="mailto:hello@allagentconnect.com?subject=Remove%20My%20Account&body=Please%20remove%20my%20account." style="color:#94a3b8;text-decoration:underline;">Remove my account</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
