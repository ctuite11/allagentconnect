// Hot Sheet preview email — safe, email-client friendly design.
// - Uses standard AAC dark header/footer via buildAacEmail (default shell).
// - Headline + short body paragraphs.
// - One dark "locked" preview panel: heavily blurred, dimmed listing image as
//   background with ≥70% dark overlay and centered "Hot Sheet Preview Locked"
//   text. No readable listing details.
// - Compact benefit list.
// - Single green CTA.
import { buildAacEmail } from "./aacEmailTemplate.ts";

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export interface HotSheetPreviewListing {
  address: string;
  city?: string | null;
  state?: string | null;
  price?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  square_feet?: number | null;
  photoUrl?: string | null;
  property_type?: string | null;
}

// Locked preview panel. Listing image is rendered only as a heavily blurred,
// dimmed background inside a dark card. Dark overlay ≥70%. No listing details.
function renderLockedPanel(photoUrl: string | null): string {
  const bg = photoUrl
    ? `background-image:linear-gradient(rgba(11,18,32,0.82),rgba(11,18,32,0.88)),url('${escapeHtml(photoUrl)}');background-size:cover;background-position:center;filter:blur(0);`
    : `background:linear-gradient(135deg,#0b1220 0%,#1f2937 60%,#111827 100%);`;

  // Blurred <img> layer for clients that ignore background-image filters,
  // stacked under the dark overlay. Outlook fallback is a plain dark cell.
  const blurredImg = photoUrl
    ? `<!--[if !mso]><!-->
        <img src="${escapeHtml(photoUrl)}" width="520" alt="" aria-hidden="true" style="display:block;width:100%;height:200px;object-fit:cover;filter:blur(28px) brightness(0.35) saturate(0.85);transform:scale(1.25);border:0;outline:none;" />
       <!--<![endif]-->`
    : "";

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0 8px;">
      <tr><td align="center" style="padding:0;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-radius:12px;overflow:hidden;background-color:#0b1220;">
          <tr><td align="center" style="padding:0;line-height:0;${bg}">
            <!--[if !mso]><!-->
            <div style="position:relative;overflow:hidden;background-color:#0b1220;">
              ${blurredImg}
              <div style="position:absolute;inset:0;background-color:rgba(11,18,32,0.75);"></div>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="position:absolute;inset:0;">
                <tr><td align="center" valign="middle" style="padding:24px 20px;">
                  <table role="presentation" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:0 0 10px;">
                    <span style="display:inline-block;vertical-align:middle;font-size:14px;color:#22C55E;line-height:1;">&#9679;</span>
                    <span style="display:inline-block;vertical-align:middle;margin-left:8px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#ffffff;">Locked</span>
                  </td></tr></table>
                  <p style="margin:0;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:18px;font-weight:600;line-height:1.3;letter-spacing:-0.01em;color:#ffffff;">Hot Sheet Preview Locked</p>
                  <p style="margin:8px 0 0;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:12px;color:rgba(255,255,255,0.65);">Complete your profile to unlock</p>
                </td></tr>
              </table>
            </div>
            <!--<![endif]-->
            <!--[if mso]>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="background-color:#0b1220;padding:56px 24px;">
              <p style="margin:0 0 8px;font-family:Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#22C55E;">LOCKED</p>
              <p style="margin:0;font-family:Arial,sans-serif;font-size:18px;font-weight:700;color:#ffffff;">Hot Sheet Preview Locked</p>
              <p style="margin:6px 0 0;font-family:Arial,sans-serif;font-size:12px;color:#c7cbd1;">Complete your profile to unlock</p>
            </td></tr></table>
            <![endif]-->
          </td></tr>
        </table>
      </td></tr>
    </table>`;
}

function renderBenefits(): string {
  const items = [
    "Matching listings",
    "Buyer demand",
    "Referrals",
    "Broker opens",
    "Network activity",
  ];
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:18px 0 4px;">
      ${items
        .map(
          (label) => `<tr><td style="padding:6px 0;">
            <table role="presentation" cellspacing="0" cellpadding="0"><tr>
              <td valign="middle" style="padding:0 10px 0 0;font-size:14px;line-height:1;color:#22C55E;font-family:Arial,sans-serif;">&#10003;</td>
              <td valign="middle" style="font-size:14px;line-height:1.5;color:#334155;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">${escapeHtml(label)}</td>
            </tr></table>
          </td></tr>`,
        )
        .join("")}
    </table>`;
}

export interface BuildHotSheetPreviewEmailOptions {
  recipientFirstName?: string | null;
  listing: HotSheetPreviewListing;
  ctaUrl: string;
  unsubscribeUrl?: string;
  recipientEmail?: string;
}

export function buildHotSheetPreviewEmailHtml(
  opts: BuildHotSheetPreviewEmailOptions,
): string {
  const { listing, ctaUrl, unsubscribeUrl, recipientEmail } = opts;

  const body = `
    <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#334155;">
      Your personalized Hot Sheets are currently locked because your profile or market preferences haven&#39;t been completed.
    </p>
    <p style="margin:0;font-size:15px;line-height:1.6;color:#334155;">
      Complete them once and All Agent Connect will begin delivering matching listings, buyer demand, referrals, broker opens, and network activity tailored to your markets.
    </p>
    ${renderLockedPanel(listing.photoUrl || null)}
    ${renderBenefits()}
  `;

  return buildAacEmail({
    headline: "You are missing important opportunities.",
    preheader: "Your personalized Hot Sheet is waiting — complete your profile to unlock.",
    body,
    ctaLabel: "Unlock My Hot Sheets",
    ctaUrl,
    tracking: unsubscribeUrl
      ? {
          unsubscribeUrl,
          recipientEmail,
          categoryLabel: "hot sheet alerts",
        }
      : undefined,
  });
}
