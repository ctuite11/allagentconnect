import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

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
  agentPhone: string;
  message?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const {
      listingId,
      recipientEmail,
      recipientName,
      agentName,
      agentEmail,
      agentPhone,
      message = ''
    }: ShareListingRequest = await req.json();

    // Fetch listing details
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select('*')
      .eq('id', listingId)
      .single();

    if (listingError || !listing) {
      throw new Error('Listing not found');
    }

    // Build listing details HTML (without original agent info)
    const photos = listing.photos || [];
    const primaryPhoto = Array.isArray(photos) && photos.length > 0 
      ? (typeof photos[0] === 'string' ? photos[0] : photos[0]?.url || '') 
      : '';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #0F172A; color: white; padding: 20px; text-align: center; }
          .listing-image { width: 100%; height: auto; margin: 20px 0; }
          .listing-details { background: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 8px; }
          .detail-row { margin: 10px 0; }
          .price { font-size: 24px; font-weight: bold; color: #0F172A; }
          .agent-info { background: #e3f2fd; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #2196F3; }
          .message { background: #fff; padding: 15px; margin: 20px 0; border-left: 4px solid #4CAF50; }
          .button { display: inline-block; background: #2196F3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Property Shared With You</h1>
          </div>
          
          ${primaryPhoto ? `<img src="${primaryPhoto}" alt="Property Photo" class="listing-image" />` : ''}
          
          <div class="listing-details">
            <div class="price">$${listing.price?.toLocaleString()}</div>
            <div class="detail-row"><strong>Address:</strong> ${listing.address}, ${listing.city}, ${listing.state} ${listing.zip_code}</div>
            ${listing.bedrooms ? `<div class="detail-row"><strong>Bedrooms:</strong> ${listing.bedrooms}</div>` : ''}
            ${listing.bathrooms ? `<div class="detail-row"><strong>Bathrooms:</strong> ${listing.bathrooms}</div>` : ''}
            ${listing.square_feet ? `<div class="detail-row"><strong>Square Feet:</strong> ${listing.square_feet.toLocaleString()}</div>` : ''}
            ${listing.property_type ? `<div class="detail-row"><strong>Property Type:</strong> ${listing.property_type.replace(/_/g, ' ')}</div>` : ''}
            ${listing.year_built ? `<div class="detail-row"><strong>Year Built:</strong> ${listing.year_built}</div>` : ''}
            ${listing.description ? `<div class="detail-row"><strong>Description:</strong><br/>${listing.description}</div>` : ''}
          </div>

          ${message ? `
            <div class="message">
              <strong>Personal Message:</strong><br/>
              ${message}
            </div>
          ` : ''}

          <div class="agent-info">
            <h3>Your Agent Contact Information</h3>
            <div><strong>Name:</strong> ${agentName}</div>
            <div><strong>Email:</strong> ${agentEmail}</div>
            ${agentPhone ? `<div><strong>Phone:</strong> ${agentPhone}</div>` : ''}
          </div>

          <p>Interested in this property? Contact ${agentName} using the information above to schedule a viewing or ask questions.</p>
        </div>
      </body>
      </html>
    `;

    // Send email via Resend
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'All Agent Connect <noreply@mail.allagentconnect.com>',
        to: [recipientEmail],
        subject: `Property Shared: ${listing.address}`,
        html: htmlContent,
        reply_to: agentEmail,
      }),
    });

    if (!resendResponse.ok) {
      const error = await resendResponse.text();
      console.error('Resend API error:', error);
      throw new Error('Failed to send email');
    }

    console.log(`Listing ${listingId} shared to ${recipientEmail} by agent ${agentEmail}`);

    return new Response(
      JSON.stringify({ success: true, message: 'Listing shared successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error sharing listing:', error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
};

serve(handler);
