/**
 * Shared email-safe listing card renderer.
 * Mirrors the AAC SearchListingCard MLS layout:
 *   left  → photo column (240px) with status pill overlay
 *   right → ID + address  |  price + $/sqft + list date
 *           facts grid (Style, Beds, Baths, Living Area, Year Built, ...)
 *           remarks preview
 *           List Office / List Agent attribution footer
 *
 * Pure email-safe HTML: nested <table>s, inline styles, no flex/grid.
 */

import { formatListingShareEmailStreetLine } from "./listingShareEmailAddress.ts";

const AAC_PRIMARY_BLUE = "#0E56F5";

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
  if (!Array.isArray(photos) || photos.length === 0) return "";
  const first = photos[0] as unknown;
  if (typeof first === "string") return first;
  if (first && typeof first === "object") {
    const f = first as Record<string, unknown>;
    return String(f.url || f.publicUrl || "");
  }
  return "";
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
    active: { bg: "#dcfce7", fg: "#166534", label: "Active" },
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

function pickListingIdLabel(listing: any): string {
  const num = listing.listing_number || listing.mls_number;
  if (num) return `#${String(num).trim()}`;
  if (listing.id) return `#${String(listing.id).slice(0, 8).toUpperCase()}`;
  return "";
}

function pickPropertyStyle(listing: any): string {
  const styles = listing.property_styles;
  if (Array.isArray(styles) && styles.length > 0) return String(styles[0]);
  if (typeof styles === "string" && styles.trim()) return styles;
  return listing.property_type ? String(listing.property_type) : "";
}

function buildFacts(listing: any): { label: string; value: string }[] {
  const facts: { label: string; value: string }[] = [];
  const style = pickPropertyStyle(listing);
  if (style) facts.push({ label: "Style", value: humanize(style) });
  if (listing.bedrooms != null) facts.push({ label: "Beds", value: String(listing.bedrooms) });
  if (listing.bathrooms != null) facts.push({ label: "Baths", value: String(listing.bathrooms) });
  const sqft = listing.square_feet ?? listing.squareFeet;
  if (sqft) facts.push({ label: "Living Area", value: `${Number(sqft).toLocaleString()} sqft` });
  if (listing.year_built) facts.push({ label: "Year Built", value: String(listing.year_built) });
  if (listing.garage_spaces) facts.push({ label: "Garage", value: String(listing.garage_spaces) });
  if (listing.lot_size) facts.push({ label: "Lot", value: `${Number(listing.lot_size).toLocaleString()} sqft` });
  return facts;
}

function renderFactsTable(facts: { label: string; value: string }[]): string {
  if (!facts.length) return "";
  const cells = facts.map((f) =>
    `<td style="padding:5px 14px 5px 0;font-size:12px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;white-space:nowrap;"><span style="color:#71717a;">${escapeHtml(f.label)}:</span> <span style="color:#0f172a;font-weight:600;">${escapeHtml(f.value)}</span></td>`
  );
  // 2 columns per row for email safety
  const rows: string[] = [];
  for (let i = 0; i < cells.length; i += 2) {
    rows.push(`<tr>${cells[i] || ""}${cells[i + 1] || `<td></td>`}</tr>`);
  }
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:12px 0 0;border-top:1px solid #f1f5f9;padding-top:10px;width:100%;">${rows.join("")}</table>`;
}

function renderAttributionFooter(listing: any): string {
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

export interface RenderListingEmailCardOptions {
  /** Absolute base origin used to build the View Listing URL (e.g. "https://allagentconnect.com"). */
  baseUrl?: string;
  /** Optional explicit per-listing URL override. */
  listingUrl?: string;
  /** CTA label, default "View Listing". */
  ctaLabel?: string;
}

/** Render one email-safe MLS-style listing card. */
export function renderListingEmailCard(
  listing: any,
  opts: RenderListingEmailCardOptions = {},
): string {
  const baseUrl = (opts.baseUrl || "https://allagentconnect.com").replace(/\/$/, "");
  const listingUrl = opts.listingUrl || (listing?.id ? `${baseUrl}/property/${listing.id}` : "");
  const ctaLabel = opts.ctaLabel || "View Listing";

  const photoUrl = listing.photoUrl || resolvePhotoUrl(listing.photos);
  const price = formatPrice(listing.price);
  const sqft = listing.square_feet ?? listing.squareFeet;
  const numericPrice = Number(listing.price);
  const pricePerSqFt =
    Number.isFinite(numericPrice) && numericPrice > 0 && sqft && Number(sqft) > 0
      ? `$${Math.round(numericPrice / Number(sqft)).toLocaleString()}/sqft`
      : "";

  const idLabel = pickListingIdLabel(listing);
  const streetLine = formatListingShareEmailStreetLine(listing) || String(listing.address || "");
  const cityStateZip = [
    [listing.city, listing.state].filter(Boolean).join(", "),
    listing.zip_code || listing.zipCode || "",
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  const facts = buildFacts(listing);
  const factsHtml = renderFactsTable(facts);
  const attribution = renderAttributionFooter(listing);
  const status = statusPill(listing.status);

  const description = listing.description
    ? `<p style="margin:12px 0 0;font-size:13px;line-height:1.55;color:#475569;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">${escapeHtml(String(listing.description).slice(0, 240))}${String(listing.description).length > 240 ? "…" : ""}</p>`
    : "";

  const photoCellWidth = 240;
  const photoCellHeight = 180;
  const safeUrl = escapeHtml(listingUrl);
  const safeAlt = escapeHtml(streetLine || "Listing photo");

  const photoCell = `
    <td width="${photoCellWidth}" valign="top" style="width:${photoCellWidth}px;background:#f3f4f6;padding:0;position:relative;">
      ${
        photoUrl
          ? `<a href="${safeUrl}" style="text-decoration:none;display:block;line-height:0;font-size:0;"><img src="${escapeHtml(photoUrl)}" alt="${safeAlt}" width="${photoCellWidth}" height="${photoCellHeight}" style="display:block;width:${photoCellWidth}px;max-width:100%;height:${photoCellHeight}px;object-fit:cover;object-position:center;border:0;outline:none;text-decoration:none;" /></a>`
          : `<div style="box-sizing:border-box;width:${photoCellWidth}px;height:${photoCellHeight}px;line-height:${photoCellHeight}px;text-align:center;color:#9ca3af;font-size:12px;font-family:system-ui,-apple-system,sans-serif;">Photo unavailable</div>`
      }
    </td>`;

  const headerRow = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
      <tr>
        <td valign="top" style="padding-right:12px;">
          ${idLabel ? `<div style="font-size:11px;color:#64748b;font-weight:600;letter-spacing:0.04em;">${escapeHtml(idLabel)}</div>` : ""}
          <div style="margin-top:${idLabel ? "4px" : "0"};font-size:16px;font-weight:700;color:#0f172a;line-height:1.3;">${escapeHtml(streetLine)}</div>
          ${cityStateZip ? `<div style="margin-top:2px;font-size:13px;color:#64748b;line-height:1.35;">${escapeHtml(cityStateZip)}</div>` : ""}
        </td>
        <td valign="top" align="right" style="white-space:nowrap;">
          ${status ? `<div style="margin-bottom:6px;">${status}</div>` : ""}
          <div style="font-size:20px;font-weight:700;color:#0f172a;line-height:1.1;">${escapeHtml(price)}</div>
          ${pricePerSqFt ? `<div style="margin-top:2px;font-size:11px;color:#64748b;">${escapeHtml(pricePerSqFt)}</div>` : ""}
        </td>
      </tr>
    </table>`;

  const cta = listingUrl
    ? `<div style="margin-top:14px;"><a href="${safeUrl}" style="display:inline-block;background-color:${AAC_PRIMARY_BLUE};color:#ffffff;text-decoration:none;font-size:13px;font-weight:600;padding:9px 16px;border-radius:8px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">${escapeHtml(ctaLabel)}</a></div>`
    : "";

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 16px;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;background:#ffffff;box-shadow:0 1px 3px rgba(17,24,39,0.04);">
      <tr>
        ${photoCell}
        <td valign="top" style="padding:16px 18px;">
          ${headerRow}
          ${factsHtml}
          ${description}
          ${cta}
          ${attribution}
        </td>
      </tr>
    </table>`;
}