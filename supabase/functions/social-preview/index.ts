import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function isCrawler(ua: string) {
  return /facebookexternalhit|facebot|Twitterbot|LinkedInBot|pinterest|slackbot|whatsapp|telegrambot|redditbot|vkShare|embedly|quora|Discordbot|Google-Structured-Data-Testing-Tool|Mediapartners-Google|bingbot|yandex|baidu|spider|crawler|bot/i.test(
    ua || ""
  );
}

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const ua = req.headers.get("user-agent") || "";
  const url = new URL(req.url);

  try {
    // Extract listing id from paths like /property/:id or query ?id=...
    const match = url.pathname.match(/\/property\/([^\/?#]+)/);
    const listingId = match?.[1] || url.searchParams.get("id");
    if (!listingId) {
      return new Response("Missing listing id", { status: 400, headers: corsHeaders });
    }

    // Determine the canonical URL for the property page
    const xfHostHeader = req.headers.get("x-forwarded-host") || req.headers.get("x-original-host") || "";
    let host = xfHostHeader || "allagentconnect.com";
    
    // If called via the Supabase functions domain, force our real domain
    if (host.endsWith(".supabase.co")) {
      host = "allagentconnect.com";
    }
    
    const xfProto = req.headers.get("x-forwarded-proto") || "https";
    const pageUrl = `${xfProto}://${host}/property/${listingId}`;

    // If not a crawler, redirect to the actual property page
    if (!isCrawler(ua)) {
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          Location: pageUrl,
        },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: listing, error } = await supabase
      .from("listings")
      .select("*")
      .eq("id", listingId)
      .single();

    if (error || !listing) {
      console.error("Listing fetch error", error);
      return new Response("Listing not found", { status: 404, headers: corsHeaders });
    }

    // Photo URL resolution
    let photoUrl = "https://lovable.dev/opengraph-image-p98pqg.png";
    if (Array.isArray(listing.photos) && listing.photos.length) {
      const first = listing.photos[0];
      photoUrl = typeof first === "string" ? first : first?.url || photoUrl;
    }

    // Build title/description
    const title = `${listing.address}, ${listing.city}, ${listing.state} - All Agent Connect`;
    const priceText = listing.listing_type === "for_rent"
      ? `$${Number(listing.price || 0).toLocaleString()}/month`
      : `$${Number(listing.price || 0).toLocaleString()}`;

    const description = listing.description
      ? `${priceText} - ${listing.bedrooms ?? "?"} bed, ${listing.bathrooms ?? "?"} bath. ${String(listing.description).substring(0, 120)}...`
      : `${priceText} - ${listing.bedrooms ?? "?"} bed, ${listing.bathrooms ?? "?"} bath in ${listing.city}, ${listing.state}`;

    const fbAppId = Deno.env.get("FACEBOOK_APP_ID") || Deno.env.get("FB_APP_ID") || "";

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <link rel="canonical" href="${pageUrl}" />

  <meta property="og:type" content="website" />
  <meta property="og:url" content="${pageUrl}" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:image" content="${photoUrl}" />
  <meta property="og:image:secure_url" content="${photoUrl}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="Photo of ${escapeHtml(listing.address)}" />
  <meta property="og:site_name" content="All Agent Connect" />
  <meta property="og:locale" content="en_US" />
  ${fbAppId ? `<meta property=\"fb:app_id\" content=\"${escapeHtml(fbAppId)}\" />` : ""}

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:url" content="${pageUrl}" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${photoUrl}" />
  <meta name="twitter:image:alt" content="Photo of ${escapeHtml(listing.address)}" />

  <style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans,sans-serif;padding:24px;}</style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(description)}</p>
  <p><a href="${pageUrl}">View this listing on All Agent Connect</a></p>
</body>
</html>`;

    return new Response(html, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (e) {
    console.error("social-preview error", e);
    const msg = (e as any)?.message ? String((e as any).message) : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
