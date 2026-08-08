import { buildAacEmail } from "./aacEmailTemplate.ts";
import { AAC_PUBLIC_URL } from "./aacPublicUrl.ts";

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export const AGENT_ACTIVATION_NUDGE_TEMPLATE = "agent-activation-nudge";
export const AGENT_ACTIVATION_NUDGE_SUBJECT = "You're missing opportunities";

export const HOT_SHEETS_CTA_URL = `${AAC_PUBLIC_URL}/agent/hot-sheets`;
export const COMMS_CENTER_CTA_URL = `${AAC_PUBLIC_URL}/communications`;

/**
 * Product screenshots hosted in the public `brand-assets` bucket (stable HTTPS URLs).
 * Visual support only — the email reads correctly with images blocked.
 */
const HOT_SHEETS_SCREENSHOT_URL =
  "https://qocduqtfbsevnhlgsfka.supabase.co/storage/v1/object/public/brand-assets/email%2Fagent-activation-nudge%2Fhot-sheets-2026-08-08.jpg";
const COMMS_CENTER_SCREENSHOT_URL =
  "https://qocduqtfbsevnhlgsfka.supabase.co/storage/v1/object/public/brand-assets/email%2Fagent-activation-nudge%2Fcomms-center-2026-08-08.jpg";
const COMMS_FEED_SCREENSHOT_URL =
  "https://qocduqtfbsevnhlgsfka.supabase.co/storage/v1/object/public/brand-assets/email%2Fagent-activation-nudge%2Fcomms-feed-2026-08-08.jpg";

const FONT = "system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif";

function renderButton(label: string, url: string): string {
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:18px 0 0;">
      <tr><td style="border-radius:8px;background-color:#0E56F5;">
        <a href="${url}" style="display:inline-block;padding:12px 22px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;font-family:${FONT};border-radius:8px;">${escapeHtml(label)}</a>
      </td></tr></table>`;
}

function renderImage(url: string, alt: string, href: string): string {
  return `<a href="${href}" style="display:block;margin:14px 0 0;"><img src="${url}" alt="${escapeHtml(alt)}" width="560" style="display:block;width:100%;max-width:560px;height:auto;border:1px solid #e2e8f0;border-radius:10px;" /></a>`;
}

export interface AgentActivationNudgeOptions {
  agentFirstName?: string | null;
  hotSheetsUrl?: string;
  commsUrl?: string;
}

export function buildAgentActivationNudgeEmailHtml(
  opts: AgentActivationNudgeOptions = {},
): string {
  const first = opts.agentFirstName?.trim();
  // No generic "Hi there" — skip the greeting entirely when we lack a name.
  const greeting = first
    ? `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;font-family:${FONT};">Hi ${escapeHtml(first)},</p>`
    : "";

  const hotSheetsUrl = opts.hotSheetsUrl || HOT_SHEETS_CTA_URL;
  const commsUrl = opts.commsUrl || COMMS_CENTER_CTA_URL;

  const h2 =
    `margin:0 0 8px;font-size:20px;font-weight:700;line-height:1.25;color:#0f172a;font-family:${FONT};`;
  const p =
    `margin:0;font-size:15px;line-height:1.6;color:#334155;font-family:${FONT};`;

  const body = `
    ${greeting}
    <p style="margin:0 0 28px;font-size:17px;line-height:1.5;font-weight:600;color:#0f172a;font-family:${FONT};">
      Too many emails stink. Missing the one that matters can hurt.
    </p>

    <h2 style="${h2}">Don&rsquo;t miss a listing.</h2>
    <p style="${p}">Create a Hot Sheet. AAC will alert you when a matching opportunity appears.</p>
    ${renderImage(HOT_SHEETS_SCREENSHOT_URL, "Hot Sheets in All Agent Connect with alerts turned on", hotSheetsUrl)}
    ${renderButton("Create a Hot Sheet", hotSheetsUrl)}

    <div style="height:1px;background:#e2e8f0;margin:34px 0 30px;"></div>

    <h2 style="${h2}">Become part of the conversation.</h2>
    <p style="${p}">See Buyer Needs, Sales Intel, Renter Needs and conversations from agents across the network. Choose what you want to receive.</p>
    ${renderImage(COMMS_CENTER_SCREENSHOT_URL, "Communication Center channel controls for Buyer Needs, Sales Intel, Renter Needs and General Discussions", commsUrl)}
    ${renderImage(COMMS_FEED_SCREENSHOT_URL, "The Communications feed showing Coming Soon listings, Buyer Needs and agent contact details", commsUrl)}
    ${renderButton("Open Communication Center", commsUrl)}

    <div style="height:1px;background:#e2e8f0;margin:34px 0 30px;"></div>

    <h2 style="${h2}">Set it and forget it.</h2>
    <p style="${p}">Tell AAC what matters to you. We&rsquo;ll do the filtering.</p>

    <p style="margin:26px 0 0;font-size:15px;line-height:1.6;color:#0f172a;font-weight:600;font-family:${FONT};">All Agent Connect</p>
    <p style="margin:2px 0 0;font-size:14px;line-height:1.6;color:#64748b;font-family:${FONT};">By agents. For agents. All agents.</p>
  `;

  return buildAacEmail({
    headline: "You're missing opportunities",
    preheader: "Too many emails stink. Missing the one that matters can hurt.",
    body,
  });
}
