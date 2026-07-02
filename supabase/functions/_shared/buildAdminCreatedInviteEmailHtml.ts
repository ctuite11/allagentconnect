/* ------------------------------------------------------------------ */
/*  Admin-Created Agent — personal setup invite from Chris            */
/*  Deliverability test variant: NO branded hero, NO headshot footer, */
/*  NO feature bullets. Renders as a short plain personal note so it  */
/*  reads like 1:1 mail from Chris.                                   */
/* ------------------------------------------------------------------ */

import type { FooterAgent } from "./buildLicenseVerifiedEmailHtml.ts";

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export interface AdminCreatedInviteEmailOptions {
  ctaUrl: string;
  firstName?: string | null;
  preheader?: string;
  // Retained for signature compatibility with send-admin-created-invite;
  // intentionally unused in the plain-note variant.
  footerAgent?: FooterAgent | null;
}

export function buildAdminCreatedInviteEmailHtml(opts: AdminCreatedInviteEmailOptions): string {
  const { ctaUrl } = opts;
  const first = opts.firstName?.trim();
  const greetingName = first ? escapeHtml(first) : "there";
  const preheader =
    opts.preheader ??
    "A quick personal note from Chris Tuite. Activate whenever you're ready.";

  const link = escapeHtml(ctaUrl);

  // Intentionally plain: no hero, no monogram, no headshot footer, no bullets.
  // Styling limited to base font + link color so this reads like a personal note.
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Chris Tuite invited you to All Agent Connect</title>
</head>
<body style="margin:0;padding:0;background:#ffffff;color:#111111;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(preheader)}</div>
<div style="max-width:560px;margin:0 auto;padding:24px 20px;">
<p style="margin:0 0 14px;">Hi ${greetingName},</p>

<p style="margin:0 0 14px;">Since you're already a member of the All Agent Connect Facebook community, we created your account so you wouldn't have to register from scratch.</p>

<p style="margin:0 0 14px;">If you'd like to activate your account, simply click the button below to create your password.</p>

<p style="margin:0 0 14px;">There's absolutely no obligation. If now isn't the right time, your account will be here whenever you're ready.</p>

<p style="margin:0 0 20px;">We appreciate your support of the All Agent Connect community and hope you'll join us on the platform.</p>

<p style="margin:0 0 20px;"><a href="${link}" style="color:#0E56F5;text-decoration:underline;">Activate My Account</a></p>

<p style="margin:0 0 4px;">Thanks,</p>
<p style="margin:0 0 2px;">Chris Tuite</p>
<p style="margin:0;">Founder, All Agent Connect</p>
</div>
</body>
</html>`;
}