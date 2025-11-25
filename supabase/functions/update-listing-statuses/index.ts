import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting listing status update job...');

    // Query listings that should be activated
    const { data: listingsToActivate, error: queryError } = await supabase
      .from('listings')
      .select('id, address, status, go_live_date, auto_activate_on')
      .or('status.eq.coming_soon,status.eq.new')
      .not('auto_activate_on', 'is', null)
      .lte('auto_activate_on', new Date().toISOString());

    if (queryError) {
      console.error('Error querying listings:', queryError);
      throw queryError;
    }

    if (!listingsToActivate || listingsToActivate.length === 0) {
      console.log('No listings to activate at this time.');
      return new Response(
        JSON.stringify({ 
          message: 'No listings to activate',
          updatedCount: 0 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    console.log(`Found ${listingsToActivate.length} listing(s) to activate:`, listingsToActivate);

    // Update all matching listings to Active
    const listingIds = listingsToActivate.map(l => l.id);
    const { error: updateError } = await supabase
      .from('listings')
      .update({ status: 'active' })
      .in('id', listingIds);

    if (updateError) {
      console.error('Error updating listings:', updateError);
      throw updateError;
    }

    console.log(`Successfully activated ${listingsToActivate.length} listing(s).`);

    return new Response(
      JSON.stringify({ 
        message: `Successfully activated ${listingsToActivate.length} listing(s)`,
        updatedCount: listingsToActivate.length,
        listingIds 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in update-listing-statuses:', error);
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
