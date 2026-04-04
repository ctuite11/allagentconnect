import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

/**
 * Generates a dynamic OG image for a listing as an SVG rendered to the browser.
 * Uses SVG with embedded image for zero-dependency image composition.
 * 
 * Usage: /listing-og-image?id=<listing-id>
 * Returns: SVG image (1200x630) with listing photo, price badge, address, and AAC branding.
 */

const WIDTH = 1200;
const HEIGHT = 630;

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  const url = new URL(req.url);
  const listingId = url.searchParams.get("id");

  if (!listingId) {
    return new Response("Missing id", { status: 400 });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: listing, error } = await supabase
      .from("listings")
      .select("address, city, state, price, listing_type, bedrooms, bathrooms, photos")
      .eq("id", listingId)
      .single();

    if (error || !listing) {
      return new Response("Not found", { status: 404 });
    }

    // Resolve photo URL
    let photoUrl = "";
    if (Array.isArray(listing.photos) && listing.photos.length) {
      const first = listing.photos[0];
      photoUrl = typeof first === "string" ? first : first?.url || "";
    }

    const priceText = listing.listing_type === "for_rent"
      ? `$${Number(listing.price || 0).toLocaleString()}/mo`
      : `$${Number(listing.price || 0).toLocaleString()}`;

    const addressText = escapeXml(`${listing.address}`);
    const locationText = escapeXml(`${listing.city}, ${listing.state}`);
    const detailsText = `${listing.bedrooms ?? "—"} bed · ${listing.bathrooms ?? "—"} bath`;

    // Build SVG
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <linearGradient id="overlay" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0%" stop-color="#000" stop-opacity="0.85"/>
      <stop offset="50%" stop-color="#000" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0.1"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="${WIDTH}" height="${HEIGHT}" fill="#111317"/>

  ${photoUrl ? `<!-- Property photo -->
  <image href="${escapeXml(photoUrl)}" x="0" y="0" width="${WIDTH}" height="${HEIGHT}" preserveAspectRatio="xMidYMid slice"/>` : ""}

  <!-- Dark gradient overlay -->
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#overlay)"/>

  <!-- Price badge -->
  <rect x="48" y="440" width="${priceText.length * 22 + 48}" height="52" rx="8" fill="#22C55E" opacity="0.95"/>
  <text x="72" y="476" font-family="system-ui, -apple-system, sans-serif" font-size="32" font-weight="700" fill="white">${escapeXml(priceText)}</text>

  <!-- Address -->
  <text x="48" y="530" font-family="system-ui, -apple-system, sans-serif" font-size="36" font-weight="700" fill="white">${addressText}</text>

  <!-- Location + details -->
  <text x="48" y="570" font-family="system-ui, -apple-system, sans-serif" font-size="22" fill="white" opacity="0.8">${locationText} · ${escapeXml(detailsText)}</text>

  <!-- AAC branding top-right -->
  <text x="${WIDTH - 48}" y="52" font-family="system-ui, -apple-system, sans-serif" font-size="18" font-weight="600" fill="white" opacity="0.7" text-anchor="end">All Agent Connect</text>

  <!-- Bottom accent line -->
  <rect x="0" y="${HEIGHT - 4}" width="${WIDTH}" height="4" fill="#22C55E"/>
</svg>`;

    return new Response(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    });
  } catch (e) {
    console.error("listing-og-image error", e);
    return new Response("Error", { status: 500 });
  }
});
