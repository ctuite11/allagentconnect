import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import {
  LISTING_OG_PLACEHOLDER,
  resolveListingPhotoUrl,
} from "../_shared/listingPhotoUrl.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function proxyImage(url: string): Promise<Response> {
  const upstream = await fetch(url, { redirect: "follow" });
  if (!upstream.ok || !upstream.body) {
    return fetch(LISTING_OG_PLACEHOLDER).then((r) =>
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
 * Listing OG image — proxy that returns the listing's first photo.
 * Falls back to the branded placeholder when no photo exists or fetch fails.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const listingId = url.searchParams.get("id");

  if (!listingId) {
    return proxyImage(LISTING_OG_PLACEHOLDER);
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
      return proxyImage(LISTING_OG_PLACEHOLDER);
    }

    const photoUrl = resolveListingPhotoUrl(listing.photos, supabaseUrl);
    return proxyImage(photoUrl || LISTING_OG_PLACEHOLDER);
  } catch (e) {
    console.error("listing-og-image error", e);
    return proxyImage(LISTING_OG_PLACEHOLDER);
  }
});
