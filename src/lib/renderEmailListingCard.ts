/**
 * Browser-side mirror of supabase/functions/_shared/listingEmailCard.ts.
 * Renders an email-safe MLS-style listing card matching the AAC SearchListingCard layout.
 */

import { listingCardStreetHeading, type ListingAddressUnitSource } from "@/lib/utils";
import { rewriteEmailImageUrl, resolveEmailPhotoUrl } from "@/lib/emailImageUrl";

const AAC_PRIMARY_BLUE = "#0E56F5";
const AAC_EMERALD = "#22C55E";

export type EmailListingCardListing = ListingAddressUnitSource & {
  id?: string | null;
  price?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  square_feet?: number | null;
  status?: string | null;
  property_type?: string | null;
  property_styles?: unknown;
  listing_number?: string | null;
  year_built?: number | null;
  garage_spaces?: number | null;
  lot_size?: number | null;
  list_office?: string | null;
  brokerage_name?: string | null;
  listing_brokerage?: string | null;
  agent_name?: string | null;
  listing_agent_name?: string | null;
  description?: string | null;
  photos?: unknown;
  photoUrl?: string | null;
  features?: unknown;
  tags?: unknown;
  waterfront?: unknown;
};

export interface RenderEmailListingCardOptions {
  baseUrl?: string;
  listingUrl?: string;
  ctaLabel?: string;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatPrice(price: unknown): string {
  const num = typeof price === "number" ? price : Number(price);
  if (!Number.isFinite(num) || num <= 0) return "Price upon request";
  return `$${Math.round(num).toLocaleString()}`;
}

function resolvePhotoUrl(photos: unknown): string {
  return resolveEmailPhotoUrl(photos);
}

function humanize(s: unknown): string {
  return String(s ?? "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function statusPill(status: unknown): string {
  const raw = String(status ?? "").toLowerCase().trim();
  if (!raw) return "";
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    active: { bg: "#dcfce7", fg: "#166534", label: "On MLS" },
    on_mls: { bg: "#dcfce7", fg: "#166534", label: "On MLS" },
    back_on_market: { bg: "#dcfce7", fg: "#166534", label: "Back on Market" },
    off_market: { bg: "#e5e7eb", fg: "#374151", label: "Off Market" },
    active_under_contract: { bg: "#fef3c7", fg: "#92400e", label: "Under Contract" },
    under_contract: { bg: "#fef3c7", fg: "#92400e", label: "Under Contract" },
    pending: { bg: "#fef3c7", fg: "#92400e", label: "Pending" },
    coming_soon: { bg: "#dbeafe", fg: "#1e40af", label: "Coming Soon" },
    sold: { bg: "#e5e7eb", fg: "#374151", label: "Sold" },
    closed: { bg: "#e5e7eb", fg: "#374151", label: "Closed" },
    withdrawn: { bg: "#e5e7eb", fg: "#374151", label: "Withdrawn" },
    expired: { bg: "#e5e7eb", fg: "#374151", label: "Expired" },
  };
  const s = map[raw] || { bg: "#e5e7eb", fg: "#374151", label: humanize(raw) };
  return `<span style="display:inline-block;background:${s.bg};color:${s.fg};font-size:11px;font-weight:600;letter-spacing:0.02em;text-transform:uppercase;padding:3px 8px;border-radius:999px;line-height:1;">${escapeHtml(s.label)}</span>`;
}

function pickListingIdLabel(listing: EmailListingCardListing): string {
  const num = listing.listing_number;
  if (num) return `#${String(num).trim()}`;
  if (listing.id) return `#${String(listing.id).slice(0, 8).toUpperCase()}`;
  return "";
}

function pickPropertyStyle(listing: EmailListingCardListing): string {
  const styles = listing.property_styles;
  if (Array.isArray(styles) && styles.length > 0) return String(styles[0]);
  if (typeof styles === "string" && styles.trim()) return styles;
  return listing.property_type ? String(listing.property_type) : "";
}

function buildFacts(listing: EmailListingCardListing): { label: string; value: string }[] {
  const facts: { label: string; value: string }[] = [];
  const style = pickPropertyStyle(listing);
  if (style) facts.push({ label: "Style", value: humanize(style) });
  if (listing.bedrooms != null) facts.push({ label: "Beds", value: String(listing.bedrooms) });
  if (listing.bathrooms != null) facts.push({ label: "Baths", value: String(listing.bathrooms) });
  if (listing.square_feet) facts.push({ label: "Living Area", value: `${Number(listing.square_feet).toLocaleString()} sqft` });
  if (listing.year_built) facts.push({ label: "Year Built", value: String(listing.year_built) });
  if (listing.garage_spaces) facts.push({ label: "Garage", value: String(listing.garage_spaces) });
  if (listing.lot_size) facts.push({ label: "Lot", value: `${Number(listing.lot_size).toLocaleString()} sqft` });
  return facts;
}

function renderFactsTable(facts: { label: string; value: string }[]): string {
  if (!facts.length) return "";
  const cells = facts.map((f) =>
    `<td style="padding:5px 14px 5px 0;font-size:12px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;white-space:nowrap;"><span style="color:#71717a;">${escapeHtml(f.label)}:</span> <span style="color:#0f172a;font-weight:600;">${escapeHtml(f.value)}</span></td>`,
  );
  const rows: string[] = [];
  for (let i = 0; i < cells.length; i += 2) {
    rows.push(`<tr>${cells[i] || ""}${cells[i + 1] || `<td></td>`}</tr>`);
  }
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:12px 0 0;border-top:1px solid #f1f5f9;padding-top:10px;width:100%;">${rows.join("")}</table>`;
}

function renderAttributionFooter(listing: EmailListingCardListing): string {
  const office = listing.list_office || listing.listing_brokerage || listing.brokerage_name || "";
  const agent = listing.listing_agent_name || listing.agent_name || "";
  if (!office && !agent) return "";
  const left = office
    ? `<span style="color:#71717a;">Listed by:</span> <span style="color:#0f172a;font-weight:600;">${escapeHtml(office)}</span>`
    : "";
  const right = agent
    ? `<span style="color:#71717a;">Agent:</span> <span style="color:#0f172a;font-weight:600;">${escapeHtml(agent)}</span>`
    : "";
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:14px 0 0;border-top:1px solid #f1f5f9;padding-top:10px;font-size:11px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
      <tr>
        <td align="left" style="color:#71717a;">${left}</td>
        <td align="right" style="color:#71717a;">${right}</td>
      </tr>
    </table>`;
}

function formatPropertyTypeLabel(raw: unknown): string {
  const t = String(raw ?? "").trim();
  if (!t) return "";
  if (t.includes("_")) return humanize(t.replace(/_/g, " "));
  return t
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function pickBrokerageLabel(listing: EmailListingCardListing): string {
  for (const key of ["brokerage_name", "listing_brokerage", "list_office"] as const) {
    const v = listing?.[key];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return "";
}

function pickFeaturePill(listing: EmailListingCardListing): string {
  const candidates = ["waterfront", "view", "pool", "new construction"];
  const feats = (listing as any).features ?? (listing as any).tags;
  if (Array.isArray(feats)) {
    for (const f of feats) {
      const s = String(f ?? "").trim();
      if (!s) continue;
      const lc = s.toLowerCase();
      if (candidates.some((c) => lc.includes(c))) return humanize(s);
    }
    if (feats.length > 0 && typeof feats[0] === "string") return humanize(String(feats[0]));
  }
  if ((listing as any).waterfront) return "Waterfront";
  return "";
}

function renderStatusBanner(status: unknown): string {
  const raw = String(status ?? "").toLowerCase().trim();
  if (!raw) return "";
  const map: Record<string, { bg: string; label: string }> = {
    active: { bg: "#22C55E", label: "On MLS" },
    on_mls: { bg: "#22C55E", label: "On MLS" },
    back_on_market: { bg: "#22C55E", label: "Back on Market" },
    off_market: { bg: "#6B7280", label: "Off Market" },
    coming_soon: { bg: AAC_PRIMARY_BLUE, label: "Coming Soon" },
    active_under_contract: { bg: "#F59E0B", label: "Under Contract" },
    under_contract: { bg: "#F59E0B", label: "Under Contract" },
    pending: { bg: "#F59E0B", label: "Pending" },
    sold: { bg: "#6B7280", label: "Sold" },
    closed: { bg: "#6B7280", label: "Closed" },
    withdrawn: { bg: "#6B7280", label: "Withdrawn" },
    expired: { bg: "#6B7280", label: "Expired" },
  };
  const s = map[raw] || { bg: "#6B7280", label: humanize(raw) };
  return `<tr><td align="center" style="background:${s.bg};color:#ffffff;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;padding:10px 12px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">${escapeHtml(s.label)}</td></tr>`;
}

function renderStatsRow(listing: EmailListingCardListing): string {
  const parts: string[] = [];
  if (listing.bedrooms != null) parts.push(`<span style="color:#171717;font-weight:600;">${escapeHtml(String(listing.bedrooms))}</span> <span style="color:#737373;font-weight:400;">bd</span>`);
  if (listing.bathrooms != null) parts.push(`<span style="color:#171717;font-weight:600;">${escapeHtml(String(listing.bathrooms))}</span> <span style="color:#737373;font-weight:400;">ba</span>`);
  if (listing.square_feet) parts.push(`<span style="color:#171717;font-weight:600;">${escapeHtml(Number(listing.square_feet).toLocaleString())}</span> <span style="color:#737373;font-weight:400;">sqft</span>`);
  if (!parts.length) return "";
  const separator = '<span style="color:#d4d4d4;padding:0 10px;">·</span>';
  return `<p style="margin:10px 0 0;font-size:14px;line-height:1.4;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">${parts.join(separator)}</p>`;
}

/** Canonical email listing card mirroring the in-app SearchListingCard. */
export function renderEmailListingCard(
  listing: EmailListingCardListing,
  opts: RenderEmailListingCardOptions = {},
): string {
  const baseUrl = (opts.baseUrl || "https://allagentconnect.com").replace(/\/$/, "");
  const listingUrl = opts.listingUrl || (listing?.id ? `${baseUrl}/property/${listing.id}` : "");
  const safeUrl = escapeHtml(listingUrl);

  const photoUrl = rewriteEmailImageUrl(listing.photoUrl) || resolvePhotoUrl(listing.photos);
  const price = formatPrice(listing.price);
  const propertyType = formatPropertyTypeLabel(listing.property_type);
  const streetLine =
    listingCardStreetHeading(listing) || String(listing.address || "Address unavailable");
  const cityStateZip = [
    [listing.city, listing.state].filter(Boolean).join(", "),
    listing.zip_code || "",
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
  const fullAddress = [streetLine, cityStateZip].filter(Boolean).join(", ");
  const brokerage = pickBrokerageLabel(listing);
  const agentName = listing.listing_agent_name || listing.agent_name || "";
  const idLabel = pickListingIdLabel(listing);
  const featurePill = pickFeaturePill(listing);
  const statusBanner = renderStatusBanner(listing.status);
  const statsHtml = renderStatsRow(listing);

  const photoHeight = 300;
  const safeAlt = escapeHtml(fullAddress || "Listing photo");

  const photoCellInner = photoUrl
    ? `<a href="${safeUrl}" style="text-decoration:none;display:block;line-height:0;font-size:0;"><img src="${escapeHtml(photoUrl)}" alt="${safeAlt}" width="600" height="${photoHeight}" style="display:block;width:100%;max-width:600px;height:${photoHeight}px;object-fit:cover;object-position:center;border:0;outline:none;text-decoration:none;" /></a>`
    : `<div style="width:100%;height:${photoHeight}px;line-height:${photoHeight}px;text-align:center;color:#9ca3af;font-size:13px;font-family:system-ui,-apple-system,sans-serif;background:#f3f4f6;">Photo unavailable</div>`;

  const featurePillRow = featurePill
    ? `<tr><td align="right" style="padding:8px 14px 0;background:#ffffff;">
         <span style="display:inline-block;background:#ffffff;color:#171717;font-size:12px;font-weight:600;padding:6px 12px;border-radius:999px;border:1px solid #e5e7eb;box-shadow:0 1px 3px rgba(0,0,0,0.08);">${escapeHtml(featurePill)}</span>
       </td></tr>`
    : "";

  const headerRow = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
      <tr>
        <td valign="top" style="padding-right:10px;">
          <div style="font-size:22px;font-weight:700;color:#0f172a;line-height:1.1;">${escapeHtml(price)}</div>
        </td>
        ${idLabel ? `<td valign="top" align="right" style="white-space:nowrap;font-size:13px;font-weight:600;color:${AAC_PRIMARY_BLUE};letter-spacing:0.02em;">ID ${escapeHtml(idLabel)}</td>` : ""}
      </tr>
    </table>`;

  const propertyTypeRow = propertyType
    ? `<div style="margin-top:4px;font-size:14px;font-weight:600;color:#404040;line-height:1.3;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">${escapeHtml(propertyType)}</div>`
    : "";

  const addressRow = fullAddress
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:14px 0 0;">
         <tr>
           <td width="18" valign="top" style="padding:2px 6px 0 0;line-height:0;">
             <img src="data:image/svg+xml;utf8,${encodeURIComponent(
               `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${AAC_EMERALD}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`,
             )}" width="14" height="14" alt="" style="display:block;width:14px;height:14px;border:0;outline:none;" />
           </td>
           <td valign="top" style="font-size:14px;line-height:1.4;color:#171717;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">${escapeHtml(fullAddress)}</td>
         </tr>
       </table>`
    : "";

  const footerRow = (brokerage || agentName)
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:16px 0 0;border-top:1px solid #f1f5f9;padding-top:12px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
         <tr>
           <td align="left" style="font-size:12px;color:#737373;line-height:1.3;">${escapeHtml(brokerage)}</td>
           <td align="right" style="font-size:12px;color:#171717;font-weight:600;line-height:1.3;white-space:nowrap;">${escapeHtml(agentName)}</td>
         </tr>
       </table>`
    : "";

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 18px;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;background:#ffffff;box-shadow:0 1px 3px rgba(17,24,39,0.06);">
      ${statusBanner}
      <tr>
        <td style="padding:0;line-height:0;font-size:0;background:#f3f4f6;">
          ${photoCellInner}
        </td>
      </tr>
      ${featurePillRow}
      <tr>
        <td valign="top" style="padding:14px 16px 16px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
          ${headerRow}
          ${propertyTypeRow}
          ${addressRow}
          ${statsHtml}
          ${footerRow}
        </td>
      </tr>
    </table>`;
}