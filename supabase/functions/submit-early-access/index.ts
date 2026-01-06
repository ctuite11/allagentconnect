import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EarlyAccessRequest {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  brokerage: string;
  state: string;
  license_number: string;
  markets?: string;
  specialties?: string[];
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body: EarlyAccessRequest = await req.json();
    
    // Validate required fields
    const requiredFields = ['first_name', 'last_name', 'email', 'brokerage', 'state', 'license_number'];
    for (const field of requiredFields) {
      if (!body[field as keyof EarlyAccessRequest] || String(body[field as keyof EarlyAccessRequest]).trim() === '') {
        return new Response(
          JSON.stringify({ error: `Missing required field: ${field}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role for insert
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Normalize email to lowercase
    const normalizedEmail = body.email.toLowerCase().trim();

    // Attempt insert - unique constraint will catch duplicates
    const { data, error } = await supabase
      .from('agent_early_access')
      .insert({
        first_name: body.first_name.trim(),
        last_name: body.last_name.trim(),
        email: normalizedEmail,
        phone: body.phone?.trim() || null,
        brokerage: body.brokerage.trim(),
        state: body.state.trim(),
        license_number: body.license_number.trim(),
        markets: body.markets?.trim() || null,
        specialties: body.specialties || null,
        status: 'pending',
        founding_partner: false,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Insert error:', error);
      
      // Check for unique constraint violation (duplicate email)
      if (error.code === '23505' || error.message?.includes('duplicate') || error.message?.includes('unique')) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            duplicate: true,
            message: "This email is already on our early access list. We'll be in touch soon."
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: 'Failed to submit. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Early access submission successful:', data.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "You're on the list!"
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Unexpected error:', err);
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
