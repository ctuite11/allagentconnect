/**
 * Lean transactional HTML for internal admin "license verification submitted" alerts.
 * Intentionally does NOT use buildAacEmail (marketing shell / remove-account footer).
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

export type AdminVerificationSubmittedEmailOpts = {
  fullName: string;
  email: string;
  phone?: string;
  company?: string;
  licenseState: string;
  licenseNumber: string;
  submittedDisplay: string;
  adminUrl: string;
  licenseLookupUrl?: string;
  /** When false, omit the small wordmark (text-only brand line). Default true. */
  includeWordmark?: boolean;
};

/**
 * Minimal admin notification: agent details + review link only.
 * Plain-text alternative is derived by sendEmail.htmlToPlainText.
 */
export function buildAdminVerificationSubmittedEmailHtml(
  opts: AdminVerificationSubmittedEmailOpts,
): string {
  const fullName = escapeHtml(opts.fullName);
  const email = escapeHtml(opts.email);
  const phone = opts.phone?.trim() ? escapeHtml(opts.phone.trim()) : "";
  const company = opts.company?.trim() ? escapeHtml(opts.company.trim()) : "";
  const licenseState = escapeHtml(opts.licenseState);
  const licenseNumber = escapeHtml(opts.licenseNumber);
  const submittedDisplay = escapeHtml(opts.submittedDisplay);
  const adminUrl = escapeHtml(opts.adminUrl);
  const licenseLookupUrl = opts.licenseLookupUrl?.trim()
    ? escapeHtml(opts.licenseLookupUrl.trim())
    : "";
  const includeWordmark = opts.includeWordmark !== false;

  const preheader = escapeHtml(
    `New verification: ${opts.fullName} — ${opts.licenseState} #${opts.licenseNumber}`,
  );

  const row = (label: string, valueHtml: string) =>
    `<tr>
      <td style="padding:6px 0;color:#64748b;font-size:14px;vertical-align:top;width:120px;">${escapeHtml(label)}</td>
      <td style="padding:6px 0;color:#0f172a;font-size:14px;font-weight:600;vertical-align:top;">${valueHtml}</td>
    </tr>`;

  const wordmarkHtml = includeWordmark
    ? `<img src="${WORDMARK_URL}" width="28" height="28" alt="" style="display:block;border:0;outline:none;margin:0 0 12px;" />`
    : "";

  const lookupHtml = licenseLookupUrl
    ? `<p style="margin:16px 0 0;font-size:13px;line-height:1.5;">
        <a href="${licenseLookupUrl}" style="color:#0E56F5;text-decoration:underline;">State license lookup (${licenseState})</a>
      </p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>New license verification</title>
</head>
<body style="margin:0;padding:0;background:#ffffff;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#0f172a;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#ffffff;">
    <tr><td style="padding:24px 16px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;">
        <tr><td style="padding:0 0 20px;border-bottom:1px solid #e5e7eb;">
          ${wordmarkHtml}
          <p style="margin:0;font-size:13px;color:#64748b;">All Agent Connect · Admin notification</p>
          <h1 style="margin:8px 0 0;font-size:18px;font-weight:700;line-height:1.3;color:#0f172a;">New license verification</h1>
        </td></tr>
        <tr><td style="padding:20px 0 0;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
            ${row("Name", fullName)}
            ${row("Email", `<a href="mailto:${email}" style="color:#0E56F5;text-decoration:underline;font-weight:600;">${email}</a>`)}
            ${phone ? row("Phone", phone) : ""}
            ${company ? row("Company", company) : ""}
            ${row("License #", licenseNumber)}
            ${row("State", licenseState)}
            ${row("Submitted", submittedDisplay)}
          </table>
          <p style="margin:24px 0 0;font-size:14px;line-height:1.5;">
            <a href="${adminUrl}" style="color:#0E56F5;text-decoration:underline;font-weight:600;">Review in Admin Approvals</a>
          </p>
          ${lookupHtml}
          <p style="margin:28px 0 0;font-size:12px;line-height:1.5;color:#94a3b8;">
            Internal administrative alert. Reply goes to the applicant.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
