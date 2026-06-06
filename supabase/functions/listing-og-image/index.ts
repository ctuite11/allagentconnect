import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import {
  renderListingOgImage,
  resolveListingPhotoUrl,
} from "../_shared/listingOgImageRender.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Dynamic listing OG image (1200×630 JPEG).
 * Composites the listing photo with price, address, and AAC branding.
 *
 * Usage: /listing-og-image?id=<listing-id>
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const listingId = url.searchParams.get("id");

  if (!listingId) {
    return new Response("Missing id", { status: 400, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: listing, error } = await supabase
      .from("listings")
      .select("address, city, state, price, listing_type, bedrooms, bathrooms, square_feet, photos")
      .eq("id", listingId)
      .single();

    if (error || !listing) {
      return new Response("Not found", { status: 404, headers: corsHeaders });
    }

    const jpeg = await renderListingOgImage({
      address: String(listing.address || ""),
      city: String(listing.city || ""),
      state: String(listing.state || ""),
      price: listing.price ?? null,
      listing_type: listing.listing_type ?? null,
      bedrooms: listing.bedrooms ?? null,
      bathrooms: listing.bathrooms ?? null,
      square_feet: listing.square_feet ?? null,
      photoUrl: resolveListingPhotoUrl(listing.photos),
    });

    return new Response(jpeg, {
      headers: {
        ...corsHeaders,
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    });
  } catch (e) {
    console.error("listing-og-image error", e);
    return new Response("Error", { status: 500, headers: corsHeaders });
  }
});
