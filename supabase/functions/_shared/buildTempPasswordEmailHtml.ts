/* ------------------------------------------------------------------ */
/*  Temporary password email (admin-initiated)                         */
/*  New builder. Does not modify any existing email template.          */
/* ------------------------------------------------------------------ */

import { buildAacEmail } from "./aacEmailTemplate.ts";

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export interface TempPasswordEmailOptions {
  agentName?: string | null;
  agentEmail: string;
  password: string;
  signInUrl?: string;
}

export function buildTempPasswordEmailHtml(opts: TempPasswordEmailOptions): string {
  const greeting = opts.agentName ? `Hi ${escapeHtml(opts.agentName)},` : "Hi there,";
  const signInUrl = opts.signInUrl && opts.signInUrl.trim()
    ? opts.signInUrl.trim()
    : "https://allagentconnect.com/auth";
  const email = escapeHtml(opts.agentEmail);
  const password = escapeHtml(opts.password);

  return buildAacEmail({
    headline: "Your sign-in details",
    preheader: "Your All Agent Connect password has been set. Sign in with the details below.",
    body: `
      <p style="margin:0 0 14px;font-size:15px;color:#0f172a;">${greeting}</p>
      <p style="margin:0 0 18px;font-size:15px;color:#0f172a;">Sorry for the trouble resetting your password — we set one for you directly so you can get in right away.</p>
      <div style="margin:0 0 18px;padding:16px 18px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px;">
        <table role="presentation" cellspacing="0" cellpadding="0" style="font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
          <tr>
            <td style="padding:4px 0;color:#64748b;font-size:13px;">Email</td>
            <td style="padding:4px 0 4px 14px;font-weight:600;color:#0f172a;font-size:14px;">${email}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;color:#64748b;font-size:13px;">Password</td>
            <td style="padding:4px 0 4px 14px;font-weight:600;color:#0f172a;font-size:14px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;">${password}</td>
          </tr>
        </table>
      </div>
      <p style="margin:0 0 8px;font-size:14px;color:#475569;">This password does not expire.</p>
      <p style="margin:0;font-size:14px;color:#475569;">Once you are in, you can change it any time under Settings &gt; Password.</p>`,
    ctaLabel: "Sign In",
    ctaUrl: signInUrl,
  });
}