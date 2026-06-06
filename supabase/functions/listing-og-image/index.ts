import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PLACEHOLDER_URL = "https://allagentconnect.com/og/aac-og-2026-01-22.jpg";

function resolveListingPhotoUrl(photos: unknown, supabaseUrl: string): string {
  if (!Array.isArray(photos) || photos.length === 0) return "";
  const first = photos[0] as unknown;
  let raw = "";
  if (typeof first === "string") raw = first.trim();
  else if (first && typeof first === "object") {
    const row = first as Record<string, unknown>;
    raw = String(row.url || row.publicUrl || "").trim();
  }
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  // Treat as storage path under listing-photos bucket
  return `${supabaseUrl}/storage/v1/object/public/listing-photos/${raw.replace(/^\/+/, "")}`;
}

async function proxyImage(url: string): Promise<Response> {
  const upstream = await fetch(url, { redirect: "follow" });
  if (!upstream.ok || !upstream.body) {
    return fetch(PLACEHOLDER_URL).then((r) =>
      new Response(r.body, {
        headers: {
          ...corsHeaders,
          "Content-Type": r.headers.get("content-type") ?? "image/jpeg",
          "Cache-Control": "public, max-age=3600",
        },
      }),
    );
  }
  const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
  return new Response(upstream.body, {
    headers: {
      ...corsHeaders,
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}

/**
 * Listing OG image — simple proxy that returns the listing's first photo as
 * an image response. Falls back to the branded placeholder when no photo
 * exists or the upstream fetch fails. Boot-safe (no native image libs).
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const listingId = url.searchParams.get("id");

  if (!listingId) {
    return proxyImage(PLACEHOLDER_URL);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: listing, error } = await supabase
      .from("listings")
      .select("photos")
      .eq("id", listingId)
      .maybeSingle();

    if (error || !listing) {
      return proxyImage(PLACEHOLDER_URL);
    }

    const photoUrl = resolveListingPhotoUrl(listing.photos, supabaseUrl);
    return proxyImage(photoUrl || PLACEHOLDER_URL);
  } catch (e) {
    console.error("listing-og-image error", e);
    return proxyImage(PLACEHOLDER_URL);
  }
});
