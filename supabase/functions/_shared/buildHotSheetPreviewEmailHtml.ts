// Hot Sheet preview email body — full-bleed blurred luxury hero, feature row,
// AAC green CTA. Renders inside the unified AAC shell (dark header/footer),
// with the shell's default headline/padding suppressed via hideHeadline.
// Palette: AAC green (#22C55E), charcoal (#111827), neutral grays, white.
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

// Full-bleed blurred hero with dark overlay, HOT SHEET PREVIEW pill, and headline.
function renderHero(listing: HotSheetPreviewListing): string {
  const photoUrl = listing.photoUrl || "";
  const bgImage = photoUrl
    ? `background-image:url('${escapeHtml(photoUrl)}');background-size:cover;background-position:center;`
    : "";
  const heroImg = photoUrl
    ? `<img src="${escapeHtml(photoUrl)}" width="600" alt="" style="display:block;width:100%;height:340px;object-fit:cover;filter:blur(24px) saturate(0.9);transform:scale(1.15);border:0;outline:none;" />`
    : `<div style="height:340px;background:linear-gradient(135deg,#0b1220 0%,#1f2937 60%,#111827 100%);"></div>`;

  // Layer via VML for Outlook + z-index-less HTML tables for everyone else.
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#0b1220;">
      <tr><td align="center" style="padding:0;position:relative;line-height:0;${bgImage}">
        <!--[if !mso]><!-->
        <div style="position:relative;overflow:hidden;">
          ${heroImg}
          <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(11,18,32,0.35) 0%,rgba(11,18,32,0.75) 100%);"></div>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="position:absolute;inset:0;">
            <tr><td align="center" valign="middle" style="padding:36px 32px;">
              <table role="presentation" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:0 0 14px;">
                <span style="display:inline-block;vertical-align:middle;width:8px;height:8px;background-color:#22C55E;border-radius:999px;margin-right:8px;"></span>
                <span style="font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#ffffff;">Hot Sheet Preview</span>
              </td></tr></table>
              <p style="margin:0;max-width:460px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:26px;font-weight:700;line-height:1.2;letter-spacing:-0.02em;color:#ffffff;">You are missing important opportunities.</p>
            </td></tr>
          </table>
        </div>
        <!--<![endif]-->
        <!--[if mso]>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="background-color:#0b1220;padding:56px 32px;">
          <p style="margin:0 0 12px;font-family:Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#22C55E;">HOT SHEET PREVIEW</p>
          <p style="margin:0;font-family:Arial,sans-serif;font-size:24px;font-weight:700;color:#ffffff;line-height:1.2;">You are missing important opportunities.</p>
        </td></tr></table>
        <![endif]-->
      </td></tr>
    </table>`;
}

function renderFeatureRow(): string {
  const items: Array<{ label: string; glyph: string }> = [
    { label: "Matching listings", glyph: "◉" },
    { label: "Buyer demand", glyph: "▲" },
    { label: "Referrals", glyph: "↔" },
    { label: "Broker opens", glyph: "◇" },
    { label: "Network activity", glyph: "✦" },
  ];
  const cells = items
    .map(
      (it) => `
        <td width="20%" align="center" valign="top" style="padding:0 6px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
          <table role="presentation" cellspacing="0" cellpadding="0" align="center"><tr>
            <td align="center" valign="middle" width="40" height="40" style="width:40px;height:40px;background-color:#ECFDF5;border:1px solid #A7F3D0;border-radius:999px;color:#22C55E;font-size:16px;font-weight:700;line-height:40px;text-align:center;">${it.glyph}</td>
          </tr></table>
          <p style="margin:10px 0 0;font-size:11px;font-weight:600;color:#111827;line-height:1.35;letter-spacing:0.01em;">${escapeHtml(it.label)}</p>
        </td>`,
    )
    .join("");
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:28px 0 0;">
      <tr>${cells}</tr>
    </table>`;
}

function renderCta(ctaUrl: string): string {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      <tr><td align="center" style="padding:32px 0 8px;">
        <a href="${ctaUrl}" target="_blank" style="display:inline-block;padding:14px 30px;background-color:#22C55E;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;border-radius:10px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;letter-spacing:-0.01em;">Unlock My Hot Sheets</a>
      </td></tr>
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

  // Body is edge-to-edge: hero fills the top of the white card, then padded
  // section with feature row and CTA. hideHeadline suppresses the shell's <h2>.
  const body = `
    ${renderHero(listing)}
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      <tr><td style="padding:28px 32px 36px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
        ${renderFeatureRow()}
        ${renderCta(ctaUrl)}
      </td></tr>
    </table>
  `;

  return buildAacEmail({
    headline: "Your personalized Hot Sheet is waiting",
    preheader: "Your personalized Hot Sheet is waiting",
    hideHeadline: true,
    body,
    tracking: unsubscribeUrl
      ? {
          unsubscribeUrl,
          recipientEmail,
          categoryLabel: "hot sheet alerts",
        }
      : undefined,
  });
}