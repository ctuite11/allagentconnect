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
    
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

    // ========== PART 1: Auto-activate Coming Soon / New listings ==========
    const { data: listingsToActivate, error: activateQueryError } = await supabase
      .from('listings')
      .select('id, address, status, go_live_date, auto_activate_on')
      .or('status.eq.coming_soon,status.eq.new')
      .not('auto_activate_on', 'is', null)
      .lte('auto_activate_on', new Date().toISOString());

    if (activateQueryError) {
      console.error('Error querying listings to activate:', activateQueryError);
    }

    const activatedIds: string[] = [];
    if (listingsToActivate && listingsToActivate.length > 0) {
      console.log(`Found ${listingsToActivate.length} listing(s) to activate:`, listingsToActivate);

      for (const listing of listingsToActivate) {
        const { id, status: oldStatus } = listing;

        const { error: updateError } = await supabase
          .from('listings')
          .update({ status: 'active' })
          .eq('id', id);

        if (updateError) {
          console.error(`Error activating listing ${id}:`, updateError);
          continue;
        }

        activatedIds.push(id);

        // Log status history for auto-activation
        await supabase.from('listing_status_history').insert({
          listing_id: id,
          old_status: oldStatus,
          new_status: 'active',
          changed_by: null, // null = system
          notes: 'Auto-activated by schedule',
        });
      }

      console.log(`Successfully activated ${activatedIds.length} listing(s).`);
    } else {
      console.log('No listings to activate at this time.');
    }

    // ========== PART 2: Auto-expire listings based on expiration_date ==========
    const { data: listingsToExpire, error: expireQueryError } = await supabase
      .from('listings')
      .select('id, address, status, expiration_date')
      .in('status', ['active', 'new', 'coming_soon', 'off_market'])
      .not('expiration_date', 'is', null)
      .lte('expiration_date', today);

    if (expireQueryError) {
      console.error('Error querying listings to expire:', expireQueryError);
    }

    const expiredIds: string[] = [];
    if (listingsToExpire && listingsToExpire.length > 0) {
      console.log(`Found ${listingsToExpire.length} listing(s) to expire:`, listingsToExpire);

      for (const listing of listingsToExpire) {
        const { id, status: oldStatus } = listing;

        const { error: updateError } = await supabase
          .from('listings')
          .update({ status: 'expired' })
          .eq('id', id);

        if (updateError) {
          console.error(`Error expiring listing ${id}:`, updateError);
          continue;
        }

        expiredIds.push(id);

        // Log status history for auto-expiration
        await supabase.from('listing_status_history').insert({
          listing_id: id,
          old_status: oldStatus,
          new_status: 'expired',
          changed_by: null, // null = system
          notes: 'Auto-expired based on expiration_date',
        });
      }

      console.log(`Successfully expired ${expiredIds.length} listing(s).`);
    } else {
      console.log('No listings to expire at this time.');
    }

    // ========== PART 3: Auto-remove past open house / broker tour events ==========
    const now = new Date();
    console.log('Checking for past open house/broker tour events...');

    // Fetch all listings that have a non-empty open_houses array
    const { data: listingsWithEvents, error: ohQueryError } = await supabase
      .from('listings')
      .select('id, address, open_houses')
      .not('open_houses', 'is', null);

    if (ohQueryError) {
      console.error('Error querying listings with open_houses:', ohQueryError);
    }

    let cleanedCount = 0;
    let removedEventsTotal = 0;

    if (listingsWithEvents && listingsWithEvents.length > 0) {
      for (const listing of listingsWithEvents) {
        const events = listing.open_houses as any[];
        if (!Array.isArray(events) || events.length === 0) continue;

        const upcoming = events.filter((e: any) => {
          if (!e?.date || !e?.end_time) return true; // keep malformed entries for safety
          const endDateTime = new Date(`${e.date}T${e.end_time}`);
          return endDateTime > now;
        });

        const removedCount = events.length - upcoming.length;
        if (removedCount > 0) {
          const { error: updateError } = await supabase
            .from('listings')
            .update({ open_houses: upcoming as any })
            .eq('id', listing.id);

          if (updateError) {
            console.error(`Error cleaning open_houses for listing ${listing.id}:`, updateError);
            continue;
          }

          cleanedCount++;
          removedEventsTotal += removedCount;
          console.log(`Removed ${removedCount} past event(s) from listing ${listing.id} (${listing.address})`);
        }
      }
    }

    console.log(`Open house cleanup: removed ${removedEventsTotal} past event(s) from ${cleanedCount} listing(s).`);

    return new Response(
      JSON.stringify({ 
        message: `Processed ${activatedIds.length} activation(s), ${expiredIds.length} expiration(s), and cleaned ${removedEventsTotal} past event(s)`,
        activated: {
          count: activatedIds.length,
          ids: activatedIds
        },
        expired: {
          count: expiredIds.length,
          ids: expiredIds
        },
        open_house_cleanup: {
          listings_cleaned: cleanedCount,
          events_removed: removedEventsTotal
        }
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
