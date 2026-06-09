import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { buildPropertySharedEmailSubject } from "../_shared/listingEmailSubject.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ShareListingRequest {
  listingId: string;
  recipientEmail: string;
  recipientName: string;
  agentName: string;
  agentEmail: string;
  agentPhone?: string;
  message?: string;
}

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization') ?? '';

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let parsed: ShareListingRequest;
    try {
      parsed = await req.json();
    } catch (err) {
      console.error('[send-listing-share] Invalid JSON body:', err);
      return jsonResponse({ success: false, error: 'Invalid JSON body' }, 400);
    }

    const {
      listingId,
      recipientEmail,
      recipientName,
      agentName,
      agentEmail,
      agentPhone = '',
      message = '',
    } = parsed;

    console.log('[send-listing-share] Received request:', {
      listingId,
      recipientEmail,
      recipientName,
      agentName,
      agentEmail,
      hasMessage: Boolean(message),
    });

    const required: Record<string, unknown> = {
      listingId,
      recipientEmail,
      recipientName,
      agentName,
      agentEmail,
    };
    for (const [field, value] of Object.entries(required)) {
      if (typeof value !== 'string' || value.trim() === '') {
        console.warn(`[send-listing-share] Missing required field: ${field}`);
        return jsonResponse(
          { success: false, error: `Missing required field: ${field}` },
          400,
        );
      }
    }

    // Fetch listing details
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select('*')
      .eq('id', listingId)
      .single();

    if (listingError || !listing) {
      console.error('[send-listing-share] Listing lookup failed:', listingError);
      return jsonResponse({ success: false, error: 'Listing not found' }, 404);
    }

    // Resolve photo URL (same logic as before, just for the variables payload)
    const photos = listing.photos || [];
    const primaryPhoto = Array.isArray(photos) && photos.length > 0
      ? (typeof photos[0] === 'string' ? photos[0] : (photos[0] as any)?.url || '')
      : '';

    const appUrl = Deno.env.get('APP_URL') || 'https://allagentconnect.com';
    const listingUrl = `${appUrl}/listings/${listingId}`;

    console.log(`[send-listing-share] Enqueuing job for ${recipientEmail}`);

    // Transactional 1:1 — canonical From via sendEmail, Reply-To = agent, no category.
    // Enqueue job — rendered server-side via the AAC unified template (renderEmailTemplate)
    const { error: insertError } = await supabase
      .from('email_jobs')
      .insert({
        payload: {
          provider: 'resend',
          template: 'listing-share',
          to: recipientEmail,
          subject: buildPropertySharedEmailSubject({
            address: listing.address,
            city: listing.city,
            state: listing.state,
            zip_code: listing.zip_code,
            unit_number: listing.unit_number,
            condo_details: listing.condo_details,
            property_type: listing.property_type,
          }),
          reply_to: agentEmail,
          variables: {
            recipientName,
            agentName,
            agentEmail,
            agentPhone,
            message,
            listingUrl,
            listing: {
              address: listing.address,
              city: listing.city,
              state: listing.state,
              zipCode: listing.zip_code,
              unit_number: listing.unit_number,
              condo_details: listing.condo_details,
              price: listing.price,
              bedrooms: listing.bedrooms,
              bathrooms: listing.bathrooms,
              squareFeet: listing.square_feet,
              propertyType: listing.property_type,
              property_type: listing.property_type,
              status: listing.status,
              listing_number: listing.listing_number,
              mls_number: listing.mls_number,
              brokerage_name: listing.brokerage_name,
              listing_brokerage: listing.listing_brokerage,
              list_office: listing.list_office,
              listing_agent_name: listing.listing_agent_name,
              photoUrl: primaryPhoto,
            },
          },
        },
      });

    if (insertError) {
      console.error('[send-listing-share] Failed to enqueue job:', insertError);
      return jsonResponse(
        { success: false, error: `Failed to queue email: ${insertError.message}` },
        500,
      );
    }

    console.log(`[send-listing-share] Job enqueued for ${recipientEmail}`);

    // Best-effort kick so Supabase worker sends immediately (not Netlify email-worker).
    if (authHeader.startsWith('Bearer ')) {
      try {
        await fetch(`${supabaseUrl}/functions/v1/kick-email-queue`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: authHeader,
          },
          body: '{}',
        });
      } catch (e) {
        console.warn('[send-listing-share] kick-email-queue failed (non-fatal):', e);
      }
    } else {
      console.warn('[send-listing-share] No auth header — queue will drain on schedule');
    }

    return jsonResponse({ success: true, message: 'Email queued for delivery' }, 200);
  } catch (error: unknown) {
    console.error('[send-listing-share] Error:', error);
    const message = error instanceof Error ? error.message : String(error);
    return jsonResponse({ success: false, error: message }, 500);
  }
};

serve(handler);