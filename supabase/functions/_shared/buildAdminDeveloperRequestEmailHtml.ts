/**
 * Lean transactional HTML for internal admin "developer access request" alerts.
 * Mirrors buildAdminVerificationSubmittedEmailHtml (no marketing shell).
 */

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const WORDMARK_URL = "https://allagentconnect.com/email/aac-monogram-green-128.png";

export type AdminDeveloperRequestEmailOpts = {
  fullName: string;
  email: string;
  phone?: string;
  companyName: string;
  website?: string;
  projectName?: string;
  market?: string;
  note?: string;
  submittedDisplay: string;
  adminUrl: string;
};

export function buildAdminDeveloperRequestEmailHtml(
  opts: AdminDeveloperRequestEmailOpts,
): string {
  const fullName = escapeHtml(opts.fullName);
  const email = escapeHtml(opts.email);
  const phone = opts.phone?.trim() ? escapeHtml(opts.phone.trim()) : "";
  const companyName = escapeHtml(opts.companyName);
  const website = opts.website?.trim() ? escapeHtml(opts.website.trim()) : "";
  const projectName = opts.projectName?.trim() ? escapeHtml(opts.projectName.trim()) : "";
  const market = opts.market?.trim() ? escapeHtml(opts.market.trim()) : "";
  const note = opts.note?.trim() ? escapeHtml(opts.note.trim()) : "";
  const submittedDisplay = escapeHtml(opts.submittedDisplay);
  const adminUrl = escapeHtml(opts.adminUrl);

  const preheader = escapeHtml(`New developer access request: ${opts.fullName} — ${opts.companyName}`);

  const row = (label: string, valueHtml: string) =>
    `<tr>
      <td style="padding:6px 0;color:#64748b;font-size:14px;vertical-align:top;width:120px;">${escapeHtml(label)}</td>
      <td style="padding:6px 0;color:#0f172a;font-size:14px;font-weight:600;vertical-align:top;">${valueHtml}</td>
    </tr>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>New developer access request</title>
</head>
<body style="margin:0;padding:0;background:#ffffff;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#0f172a;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#ffffff;">
    <tr><td style="padding:24px 16px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;">
        <tr><td style="padding:0 0 20px;border-bottom:1px solid #e5e7eb;">
          <img src="${WORDMARK_URL}" width="28" height="28" alt="" style="display:block;border:0;outline:none;margin:0 0 12px;" />
          <p style="margin:0;font-size:13px;color:#64748b;">All Agent Connect · Admin notification</p>
          <h1 style="margin:8px 0 0;font-size:18px;font-weight:700;line-height:1.3;color:#0f172a;">New developer access request</h1>
        </td></tr>
        <tr><td style="padding:20px 0 0;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
            ${row("Name", fullName)}
            ${row("Email", `<a href="mailto:${email}" style="color:#0E56F5;text-decoration:underline;font-weight:600;">${email}</a>`)}
            ${phone ? row("Phone", phone) : ""}
            ${row("Company", companyName)}
            ${website ? row("Website", `<a href="${website}" style="color:#0E56F5;text-decoration:underline;font-weight:600;">${website}</a>`) : ""}
            ${projectName ? row("Project", projectName) : ""}
            ${market ? row("Market", market) : ""}
            ${row("Submitted", submittedDisplay)}
          </table>
          ${note ? `<div style="margin:18px 0 0;padding:12px 14px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px;font-size:14px;line-height:1.5;white-space:pre-wrap;">${note}</div>` : ""}
          <p style="margin:24px 0 0;font-size:14px;line-height:1.5;">
            <a href="${adminUrl}" style="color:#0E56F5;text-decoration:underline;font-weight:600;">Review in Admin · Dev reviews</a>
          </p>
          <p style="margin:28px 0 0;font-size:12px;line-height:1.5;color:#94a3b8;">
            Internal administrative alert. Reply goes to the requester.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
