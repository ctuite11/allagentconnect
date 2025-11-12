import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const userAgent = req.headers.get('user-agent') || '';
    
    // Check if request is from a social media crawler
    const isCrawler = /facebookexternalhit|Twitterbot|LinkedInBot|WhatsApp|Slackbot|TelegramBot/i.test(userAgent);
    
    if (!isCrawler) {
      return new Response('Not a crawler', { status: 400 });
    }

    // Extract property ID from path or query
    const pathMatch = url.pathname.match(/\/property\/([^\/]+)/);
    const listingId = pathMatch ? pathMatch[1] : url.searchParams.get('id');

    if (!listingId) {
      return new Response('Missing listing ID', { status: 400 });
    }

    // Fetch listing data
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: listing, error } = await supabase
      .from('listings')
      .select('*')
      .eq('id', listingId)
      .single();

    if (error || !listing) {
      return new Response('Listing not found', { status: 404 });
    }

    // Get first photo URL
    let photoUrl = 'https://lovable.dev/opengraph-image-p98pqg.png';
    if (listing.photos && Array.isArray(listing.photos) && listing.photos.length > 0) {
      const photo = listing.photos[0];
      photoUrl = typeof photo === 'string' ? photo : (photo.url || photoUrl);
    }

    const title = `${listing.address}, ${listing.city}, ${listing.state} - Agent Connect`;
    const priceText = listing.listing_type === 'for_rent' 
      ? `$${listing.price.toLocaleString()}/month` 
      : `$${listing.price.toLocaleString()}`;
    
    const description = listing.description 
      ? `${priceText} - ${listing.bedrooms} bed, ${listing.bathrooms} bath. ${listing.description.substring(0, 120)}...`
      : `${priceText} - ${listing.bedrooms} bed, ${listing.bathrooms} bath property in ${listing.city}, ${listing.state}`;

    const pageUrl = `${url.origin}/property/${listingId}`;

    // Return pre-rendered HTML with proper OG tags
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="${description}">
  <link rel="canonical" href="${pageUrl}">
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${pageUrl}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${photoUrl}">
  <meta property="og:image:secure_url" content="${photoUrl}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="Photo of ${listing.address}">
  <meta property="og:site_name" content="Agent Connect">
  <meta property="og:locale" content="en_US">
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${pageUrl}">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${photoUrl}">
  <meta name="twitter:image:alt" content="Photo of ${listing.address}">
  
  <meta http-equiv="refresh" content="0;url=${pageUrl}">
</head>
<body>
  <h1>${title}</h1>
  <p>${description}</p>
  <p>Redirecting to property page...</p>
</body>
</html>`;

    return new Response(html, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Error in social-preview function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
