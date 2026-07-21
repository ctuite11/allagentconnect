import { buildAacEmail } from "./aacEmailTemplate.ts";

const IMG_BASE =
  "https://qocduqtfbsevnhlgsfka.supabase.co/storage/v1/object/public/email-attachments/comms-guide";

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export interface CommsCenterGuideEmailOptions {
  agentFirstName?: string | null;
  ctaUrl: string;
}

function renderStep(opts: {
  n: number;
  title: string;
  desc: string;
  img: string;
  alt: string;
}): string {
  return `
    <tr><td style="padding:28px 0 0;">
      <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#0E56F5;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Step ${opts.n}</p>
      <h2 style="margin:0 0 8px;font-size:20px;font-weight:700;line-height:1.25;color:#0f172a;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">${escapeHtml(opts.title)}</h2>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#334155;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">${escapeHtml(opts.desc)}</p>
      <img src="${opts.img}" alt="${escapeHtml(opts.alt)}" width="560" style="display:block;width:100%;max-width:560px;height:auto;border:1px solid #e5e7eb;border-radius:10px;" />
    </td></tr>`;
}

export function buildCommsCenterGuideEmailHtml(
  opts: CommsCenterGuideEmailOptions,
): string {
  const greeting = opts.agentFirstName?.trim()
    ? `Hi ${escapeHtml(opts.agentFirstName.trim())},`
    : "Hi there,";

  const body = `
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#334155;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">${greeting}</p>
    <p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:#334155;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
      Getting a few too many emails from All Agent Connect? We&rsquo;ve got you covered.
      Head over to your <strong>Communications Center</strong> and follow these simple steps to
      dial in exactly what you want to hear about &mdash; and just as important, what you don&rsquo;t.
    </p>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0;">
      ${renderStep({
        n: 1,
        title: "Turn channels on or off",
        desc:
          "Toggle Buyer Needs, Renter Needs, Sales Intel, and General Discussions based on what you actually want to hear about. Mute a channel and you stop receiving those alerts entirely.",
        img: `${IMG_BASE}/comms-channels.png`,
        alt: "Communications Center channel toggles",
      })}
      ${renderStep({
        n: 2,
        title: "Set your coverage area",
        desc:
          "Set a broad scope, or narrow your preferences down to a single county, a specific town, or even one neighborhood. If you leave it empty, you\u2019ll hear about everything in your state.",
        img: `${IMG_BASE}/comms-coverage.png`,
        alt: "Coverage area picker",
      })}
      ${renderStep({
        n: 3,
        title: "Choose how often you hear from us",
        desc:
          "Pick Immediately for real-time alerts, Daily digest for one summary at 6:00 PM ET, or Weekly digest for one recap every Friday at 6:00 PM ET.",
        img: `${IMG_BASE}/comms-timing.png`,
        alt: "Notification timing options",
      })}
    </table>

    <p style="margin:28px 0 0;font-size:15px;line-height:1.6;color:#334155;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
      Two minutes in your preferences will save you a whole lot of inbox noise.
    </p>
  `;

  return buildAacEmail({
    headline: "Too many emails? We\u2019ve got you covered.",
    preheader:
      "A 30-second tour of your Communications Center preferences \u2014 turn off what you don't want, keep what matters.",
    body,
    ctaLabel: "Open my Communications Center",
    ctaUrl: opts.ctaUrl,
  });
}

export const COMMS_CENTER_GUIDE_SUBJECT =
  "Too many emails? We\u2019ve got you covered.";