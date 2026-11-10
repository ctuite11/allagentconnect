import "../_shared/migrationRuntime.ts";
// @auth-classification: public-read
// Old social image URLs remain neutral after the database lockdown.
Deno.serve(req => req.method === "OPTIONS" ? new Response(null, { headers: { "Access-Control-Allow-Origin": "*" } }) :
  new Response(null, { status: 302, headers: {
    Location: "https://allagentconnect.com/og/aac-og-2026-01-22.jpg",
    "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow", "Access-Control-Allow-Origin": "*",
  } }));
