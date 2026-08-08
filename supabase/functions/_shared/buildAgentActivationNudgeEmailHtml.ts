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
export const AGENT_ACTIVATION_NUDGE_SUBJECT =
  "Don't miss opportunities on All Agent Connect";

export const HOT_SHEETS_CTA_URL = `${AAC_PUBLIC_URL}/agent/hot-sheets`;
export const COMMS_CENTER_CTA_URL = `${AAC_PUBLIC_URL}/communications`;

const FONT =
  "system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif";

function renderButton(label: string, url: string): string {
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:16px 0 0;">
      <tr><td style="border-radius:8px;background-color:#0E56F5;">
        <a href="${url}" style="display:inline-block;padding:12px 22px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;font-family:${FONT};border-radius:8px;">${escapeHtml(label)}</a>
      </td></tr>
    </table>`;
}

function renderSection(opts: {
  title: string;
  paragraphs: string[];
  ctaLabel: string;
  ctaUrl: string;
}): string {
  const paras = opts.paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:#334155;font-family:${FONT};">${p}</p>`,
    )
    .join("");
  return `
    <tr><td style="padding:26px 0 0;">
      <h2 style="margin:0 0 8px;font-size:19px;font-weight:700;line-height:1.25;color:#0f172a;font-family:${FONT};">${escapeHtml(opts.title)}</h2>
      ${paras}
      ${renderButton(opts.ctaLabel, opts.ctaUrl)}
    </td></tr>`;
}

export interface AgentActivationNudgeOptions {
  agentFirstName?: string | null;
  hotSheetsUrl?: string;
  commsUrl?: string;
}

export function buildAgentActivationNudgeEmailHtml(
  opts: AgentActivationNudgeOptions = {},
): string {
  const greeting = opts.agentFirstName?.trim()
    ? `Hi ${escapeHtml(opts.agentFirstName.trim())},`
    : "Hi there,";

  const hotSheetsUrl = opts.hotSheetsUrl || HOT_SHEETS_CTA_URL;
  const commsUrl = opts.commsUrl || COMMS_CENTER_CTA_URL;

  const body = `
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#334155;font-family:${FONT};">${greeting}</p>
    <p style="margin:0 0 4px;font-size:15px;line-height:1.6;color:#334155;font-family:${FONT};">
      All Agent Connect can do more of the work for you &mdash; but there are two tools you should be using:
    </p>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0;">
      ${renderSection({
        title: "Hot Sheets",
        paragraphs: [
          "Create a Hot Sheet for what you or your buyers are looking for. AAC will automatically match you with Off Market, Coming Soon and active listings that fit your criteria and alert you when new opportunities appear.",
        ],
        ctaLabel: "Create a Hot Sheet",
        ctaUrl: hotSheetsUrl,
      })}
      ${renderSection({
        title: "Communication Center",
        paragraphs: [
          "You control what you want to hear about from other agents. Choose the areas, property types and types of communications that matter to you &mdash; and turn off the ones that don&rsquo;t.",
          "Use it for Buyer Needs, Renter Needs, Sales Intel and agent discussions without getting emails that aren&rsquo;t relevant to your business.",
        ],
        ctaLabel: "Open Communication Center",
        ctaUrl: commsUrl,
      })}
    </table>

    <p style="margin:30px 0 0;font-size:15px;line-height:1.6;color:#334155;font-family:${FONT};">
      Set it once. AAC keeps working for you.
    </p>
    <p style="margin:16px 0 0;font-size:15px;line-height:1.6;color:#0f172a;font-weight:600;font-family:${FONT};">
      All Agent Connect
    </p>
    <p style="margin:2px 0 0;font-size:14px;line-height:1.6;color:#64748b;font-family:${FONT};">
      By agents. For agents. All agents.
    </p>
  `;

  return buildAacEmail({
    headline: "Don't miss opportunities on All Agent Connect",
    preheader:
      "Two tools that do the work for you: Hot Sheets and your Communication Center.",
    body,
  });
}
