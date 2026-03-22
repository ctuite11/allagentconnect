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

export function buildAacEmail(opts: AacEmailOptions): string {
  const { headline, body, ctaLabel, ctaUrl, preheader } = opts;

  const preheaderHtml = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(preheader)}</div>`
    : "";

  const ctaHtml =
    ctaLabel && ctaUrl
      ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr><td align="center" style="padding:28px 0 0;">
            <a href="${ctaUrl}" target="_blank" style="display:inline-block;padding:14px 28px;background-color:#50c878;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;border-radius:8px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">${escapeHtml(ctaLabel)}</a>
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
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;">

        <!-- Dark navy branded header -->
        <tr><td align="center" style="background-color:#111317;border-radius:12px 12px 0 0;padding:32px 40px 0;">
          <table role="presentation" cellspacing="0" cellpadding="0"><tr><td align="center">
            <!--[if mso]><v:rect xmlns:v="urn:schemas-microsoft-com:vml" style="width:40px;height:40px;" fill="false" stroke="false"><v:textbox inset="0,0,0,0" style="mso-fit-shape-to-text:false;"><center style="font-size:16px;font-weight:700;color:#50c878;font-family:Arial,sans-serif;">✦</center></v:textbox></v:rect><![endif]-->
            <!--[if !mso]><!-->
            <img src="data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMzQgMzQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgZmlsbD0iIzUwYzg3OCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMjIuNjY2NyAxMS4zMzMzSDExLjMzMzNWMjIuNjY2N0gyMi42NjY3VjExLjMzMzNaIi8+PHBhdGggZD0iTTIuODMzMzMgMjYuOTE2N0MyLjgzMzMzIDI5LjI1NDIgNC43NDU4MyAzMS4xNjY3IDcuMDgzMzMgMzEuMTY2N0M5LjQyMDgzIDMxLjE2NjcgMTEuMzMzMyAyOS4yNTQyIDExLjMzMzMgMjYuOTE2N1YyMi42NjY3SDcuMDgzMzNDNC43NDU4MyAyMi42NjY3IDIuODMzMzMgMjQuNTc5MiAyLjgzMzMzIDI2LjkxNjdaIi8+PHBhdGggZD0iTTcuMDgzMzMgMi44MzMzM0M0Ljc0NTgzIDIuODMzMzMgMi44MzMzMyA0Ljc0NTgzIDIuODMzMzMgNy4wODMzM0MyLjgzMzMzIDkuNDIwODMgNC43NDU4MyAxMS4zMzMzIDcuMDgzMzMgMTEuMzMzM0gxMS4zMzMzVjcuMDgzMzNDMTEuMzMzMyA0Ljc0NTgzIDkuNDIwODMgMi44MzMzMyA3LjA4MzMzIDIuODMzMzNaIi8+PHBhdGggZD0iTTMxLjE2NjcgNy4wODMzM0MzMS4xNjY3IDQuNzQ1ODMgMjkuMjU0MiAyLjgzMzMzIDI2LjkxNjcgMi44MzMzM0MyNC41NzkyIDIuODMzMzMgMjIuNjY2NyA0Ljc0NTgzIDIyLjY2NjcgNy4wODMzM1YxMS4zMzMzSDI2LjkxNjdDMjkuMjU0MiAxMS4zMzMzIDMxLjE2NjcgOS40MjA4MyAzMS4xNjY3IDcuMDgzMzNaIi8+PHBhdGggZD0iTTI2LjkxNjcgMjIuNjY2N0gyMi42NjY3VjI2LjkxNjdDMjIuNjY2NyAyOS4yNTQyIDI0LjU3OTIgMzEuMTY2NyAyNi45MTY3IDMxLjE2NjdDMjkuMjU0MiAzMS4xNjY3IDMxLjE2NjcgMjkuMjU0MiAzMS4xNjY3IDI2LjkxNjdDMzEuMTY2NyAyNC41NzkyIDI5LjI1NDIgMjIuNjY2NyAyNi45MTY3IDIyLjY2NjdaIi8+PC9zdmc+" width="40" height="40" alt="All Agent Connect" style="display:block;border:0;outline:none;text-decoration:none;" />
            <!--<![endif]-->
          </td></tr></table>
          <p style="margin:12px 0 0;font-size:18px;font-weight:600;letter-spacing:-0.02em;color:#ffffff;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">All Agent Connect</p>
          <div style="width:48px;height:2px;background-color:#50c878;margin:16px auto 0;border-radius:1px;"></div>
          <div style="height:24px;"></div>
        </td></tr>

        <!-- White content body -->
        <tr><td style="background-color:#ffffff;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;border-top:none;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            <!-- Content -->
            <tr><td style="padding:28px 40px 32px;">
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
    </td></tr>
  </table>
</body>
</html>`;
}
