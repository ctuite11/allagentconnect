import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { address, zipCode, city, state } = await req.json();
    const attomApiKey = Deno.env.get('ATTOM_API_KEY');

    if (!attomApiKey) {
      throw new Error('ATTOM API key not configured');
    }

    console.log('Fetching ATTOM market data for:', { address, zipCode, city, state });

    const headers = {
      'apikey': attomApiKey,
      'accept': 'application/json',
    };

    // Fetch multiple ATTOM endpoints for comprehensive market insights
    const [salesTrends, avm, demographics, comparables] = await Promise.allSettled([
      // Sales Trends for the zip code
      fetch(`https://api.gateway.attomdata.com/propertyapi/v1.0.0/salestrend/snapshot?postalcode=${zipCode}`, { headers })
        .then(res => res.ok ? res.json() : null),
      
      // AVM (Automated Valuation Model) - requires full address
      address ? fetch(`https://api.gateway.attomdata.com/propertyapi/v1.0.0/avm/detail?address1=${encodeURIComponent(address)}&address2=${encodeURIComponent(`${city}, ${state} ${zipCode}`)}`, { headers })
        .then(res => res.ok ? res.json() : null) : Promise.resolve(null),
      
      // Demographics for the area
      fetch(`https://api.gateway.attomdata.com/propertyapi/v1.0.0/area/full?postalcode=${zipCode}`, { headers })
        .then(res => res.ok ? res.json() : null),
      
      // Recent sales comparables in the area
      fetch(`https://api.gateway.attomdata.com/propertyapi/v1.0.0/sale/snapshot?postalcode=${zipCode}&radius=1`, { headers })
        .then(res => res.ok ? res.json() : null),
    ]);

    const marketData = {
      salesTrends: salesTrends.status === 'fulfilled' ? salesTrends.value : null,
      avm: avm.status === 'fulfilled' ? avm.value : null,
      demographics: demographics.status === 'fulfilled' ? demographics.value : null,
      comparables: comparables.status === 'fulfilled' ? comparables.value : null,
      fetchedAt: new Date().toISOString(),
    };

    console.log('ATTOM market data fetched successfully');

    return new Response(
      JSON.stringify(marketData),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('Error fetching ATTOM market data:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
