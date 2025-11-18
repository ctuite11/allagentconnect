import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

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

    // Build address strings
    const fullAddress = [address, city, state && zip ? `${state} ${zip}` : state || zip]
      .filter(Boolean)
      .join(", ");

    // Prefer basicprofile by full address, then fallback to address1/address2
    const urlBasic = `https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/basicprofile?address=${encodeURIComponent(fullAddress)}&debug=true`;
    const urlAddr = `https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/address?address1=${encodeURIComponent(address)}&address2=${encodeURIComponent([city, state && zip ? `${state} ${zip}` : state || zip].filter(Boolean).join(', '))}`;

    console.log("[test-attom] Requesting basicprofile:", urlBasic);

    let resp = await fetch(urlBasic, {
      headers: { accept: "application/json", apikey: attomApiKey },
    });

    let text = await resp.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch {}

    if (!resp.ok || !json?.property?.length) {
      console.warn("[test-attom] basicprofile returned no property, trying address endpoint...", resp.status);
      console.log("[test-attom] Requesting address:", urlAddr);
      resp = await fetch(urlAddr, { headers: { accept: "application/json", apikey: attomApiKey } });
      text = await resp.text();
      json = null;
      try { json = JSON.parse(text); } catch {}
    }

    console.log("[test-attom] Final status:", resp.status);

    return new Response(
      JSON.stringify({
        ok: resp.ok,
        status: resp.status,
        urlTried: { basicprofile: urlBasic, address: urlAddr },
        address1: address,
        address2: [city, state && zip ? `${state} ${zip}` : state || zip].filter(Boolean).join(', '),
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