import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const attomApiKey = Deno.env.get("ATTOM_API_KEY");
    if (!attomApiKey) {
      console.error("ATTOM_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "ATTOM_API_KEY missing in backend configuration" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { address, city, state, zip } = await req.json();

    if (!address) {
      return new Response(
        JSON.stringify({ error: "address is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const parts: string[] = [];
    if (city) parts.push(city);
    if (state && zip) parts.push(`${state} ${zip}`);
    else if (state) parts.push(state);
    else if (zip) parts.push(zip);
    const address2 = parts.join(", ");

    const url = `https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/address?address1=${encodeURIComponent(address)}&address2=${encodeURIComponent(address2)}`;

    console.log("[test-attom] Requesting:", url);

    const resp = await fetch(url, {
      headers: {
        accept: "application/json",
        apikey: attomApiKey,
      },
    });

    const text = await resp.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch { /* leave as text */ }

    console.log("[test-attom] Status:", resp.status);

    return new Response(
      JSON.stringify({
        ok: resp.ok,
        status: resp.status,
        url,
        address1: address,
        address2,
        json,
        raw: json ? undefined : text,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[test-attom] Error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});