/**
 * New Developments notification email builder (DRAFT 2 — not deployed).
 *
 * Review item 3: delivery only renders `payload.html` when it is supplied,
 * otherwise it calls renderEmailTemplate(), which fails closed on unknown
 * templates. These two templates are deliberately NOT added to the frozen
 * renderer — the submission functions render here and enqueue the HTML in
 * `payload.html`, so nothing in the existing email renderer changes.
 *
 * Every interpolated value is user- or developer-controlled and is escaped.
 */
// NOTE (draft location only): on apply this file moves to
// supabase/functions/_shared/ and these two imports become
//   import { buildAacEmail } from "./aacEmailTemplate.ts";
//   import { AAC_PUBLIC_URL } from "./aacPublicUrl.ts";
import { buildAacEmail } from "../../../../../supabase/functions/_shared/aacEmailTemplate.ts";
import { AAC_PUBLIC_URL } from "../../../../../supabase/functions/_shared/aacPublicUrl.ts";

export const DEVELOPMENT_LEAD_TEMPLATE = "development-lead-notification";
export const DEVELOPMENT_SHOWING_TEMPLATE = "development-showing-request-notification";
export const DEVELOPMENT_EMAIL_STREAM = "development_notifications";

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const FONT = "system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif";

export type DevelopmentNotificationKind = "lead" | "showing";

export interface DevelopmentNotificationInput {
  kind: DevelopmentNotificationKind;
  recipientName?: string | null;
  developmentName: string;
  developmentSlug: string;
  unitLabel?: string | null;
  agentName: string;
  agentEmail: string;
  agentPhone?: string | null;
  agentBrokerage?: string | null;
  message?: string | null;
  preferredDate?: string | null;
  preferredTime?: string | null;
  submittedAt: string;
}

function row(label: string, value: string | null | undefined): string {
  if (!value) return "";
  return `<tr>
    <td style="padding:6px 12px 6px 0;font-size:13px;color:#64748b;font-family:${FONT};white-space:nowrap;vertical-align:top;">${escapeHtml(label)}</td>
    <td style="padding:6px 0;font-size:14px;color:#0f172a;font-family:${FONT};">${escapeHtml(value)}</td>
  </tr>`;
}

/** Multi-line free text: escape first, then convert newlines to <br />. */
function paragraph(text: string): string {
  return escapeHtml(text).replaceAll("\r\n", "\n").split("\n").join("<br />");
}

export function buildDevelopmentNotificationSubject(input: DevelopmentNotificationInput): string {
  const unit = input.unitLabel ? ` — Unit ${input.unitLabel}` : "";
  return input.kind === "lead"
    ? `New agent inquiry: ${input.developmentName}${unit}`
    : `New showing request: ${input.developmentName}${unit}`;
}

export function buildDevelopmentNotificationEmailHtml(
  input: DevelopmentNotificationInput,
): string {
  const isLead = input.kind === "lead";
  const headline = isLead ? "New agent inquiry" : "New showing request";
  const ctaUrl = `${AAC_PUBLIC_URL}/developments/${encodeURIComponent(input.developmentSlug)}/${isLead ? "leads" : "showings"}`;

  const greeting = input.recipientName?.trim()
    ? `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;font-family:${FONT};">Hi ${escapeHtml(input.recipientName.trim())},</p>`
    : "";

  const details = `
    <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;margin:8px 0 0;">
      ${row("Development", input.developmentName)}
      ${row("Unit", input.unitLabel ?? null)}
      ${row("Agent", input.agentName)}
      ${row("Brokerage", input.agentBrokerage ?? null)}
      ${row("Email", input.agentEmail)}
      ${row("Phone", input.agentPhone ?? null)}
      ${isLead ? "" : row("Preferred date", input.preferredDate ?? null)}
      ${isLead ? "" : row("Preferred time", input.preferredTime ?? null)}
      ${row("Submitted", input.submittedAt)}
    </table>`;

  const messageBlock = input.message?.trim()
    ? `<div style="margin:18px 0 0;padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">
         <p style="margin:0 0 6px;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#64748b;font-family:${FONT};">Message</p>
         <p style="margin:0;font-size:14px;line-height:1.6;color:#0f172a;font-family:${FONT};">${paragraph(input.message.trim())}</p>
       </div>`
    : "";

  const body = `
    ${greeting}
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#334155;font-family:${FONT};">
      ${isLead
        ? "An AAC agent submitted an inquiry about your development."
        : "An AAC agent requested a showing at your development."}
    </p>
    ${details}
    ${messageBlock}`;

  return buildAacEmail({
    headline,
    body,
    ctaLabel: isLead ? "View lead" : "View showing request",
    ctaUrl,
    preheader: `${headline} — ${input.developmentName}`,
    hideRemoveAccountLink: true,
  });
}
