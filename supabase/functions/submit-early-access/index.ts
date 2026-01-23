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

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

    // Send welcome email to the agent
    const welcomeEmailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.7; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #ffffff;">
        <div style="margin-bottom: 32px;">
          <span style="font-size: 20px; font-weight: 600; color: #0E56F5;">All Agent</span><span style="font-size: 20px; font-weight: 600; color: #94A3B8;"> Connect</span>
        </div>
        
        <p style="margin: 0 0 24px 0; font-size: 16px;">Hi ${body.first_name},</p>
        
        <p style="margin: 0 0 24px 0; font-size: 16px;">You're officially confirmed for Early Access to All Agent Connect.</p>
        
        <p style="margin: 0 0 24px 0; font-size: 16px;">All Agent Connect was built to elevate agent collaboration to the next level — providing a private, professional network focused on real opportunities, without the noise of public portals.</p>
        
        <p style="margin: 0 0 16px 0; font-size: 16px;">As an Early Access member, you'll be among the first agents to use a platform designed around:</p>
        
        <ul style="margin: 0 0 24px 0; padding-left: 24px; font-size: 16px;">
          <li style="margin-bottom: 12px;">A private, agent-only environment with MLS-style listing search</li>
          <li style="margin-bottom: 12px;">Direct agent-to-agent communication around opportunities and active needs</li>
          <li style="margin-bottom: 12px;">The ability to share and receive buyer and renter needs in a targeted, professional way</li>
          <li style="margin-bottom: 12px;">Custom Hot Sheets you control — for yourself and for your clients</li>
          <li style="margin-bottom: 12px;">Full control over what you see and when you see it</li>
        </ul>
        
        <p style="margin: 0 0 24px 0; font-size: 16px;">All Agent Connect is built by agents, for agents — all agents, with a focus on increasing efficiency, production, and deal velocity.</p>
        
        <p style="margin: 0 0 32px 0; font-size: 16px;">We'll be in touch soon with additional updates and next steps as we approach launch.</p>
        
        <p style="margin: 0 0 8px 0; font-size: 16px;">Welcome to the network,</p>
        <p style="margin: 0; font-size: 16px; font-weight: 600;"><span style="color: #0E56F5;">All Agent</span><span style="color: #94A3B8;"> Connect</span></p>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 40px 0 24px 0;">
        
              <p style="color: #6b7280; font-size: 12px; margin: 0 0 8px 0;">
                All Agent Connect · hello@allagentconnect.com
              </p>
              <p style="color: #9ca3af; font-size: 11px; margin: 0;">
                <a href="mailto:hello@allagentconnect.com?subject=Remove%20My%20Account&body=Please%20remove%20my%20account%20from%20AllAgentConnect." style="color: #9ca3af; text-decoration: underline;">Click here</a> to request account removal.
              </p>
      </body>
      </html>
    `;

    try {
      const welcomeRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "All Agent Connect <hello@mail.allagentconnect.com>",
          reply_to: "hello@allagentconnect.com",
          to: [normalizedEmail],
          subject: "Welcome to All Agent Connect Early Access",
          html: welcomeEmailHtml,
        }),
      });

      if (!welcomeRes.ok) {
        console.error("Failed to send welcome email:", await welcomeRes.json());
      } else {
        console.log("Welcome email sent to:", normalizedEmail);
      }
    } catch (welcomeErr) {
      console.error("Welcome email error:", welcomeErr);
    }

    // Send admin notification email
    const ADMIN_EMAIL = "chris@allagentconnect.com";
    const ADMIN_PANEL_URL = "https://allagentconnect.com/admin/approvals";

    const adminEmailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #0E56F5 0%, #1e40af 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">🚀 New Early Access Request</h1>
        </div>
        
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
          <h2 style="color: #0f172a; margin-top: 0;">Pre-Launch Registration</h2>
          
          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Name:</td>
                <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${body.first_name} ${body.last_name}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Email:</td>
                <td style="padding: 8px 0; color: #0f172a;"><a href="mailto:${normalizedEmail}" style="color: #2563eb;">${normalizedEmail}</a></td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Phone:</td>
                <td style="padding: 8px 0; color: #0f172a;">${body.phone || 'Not provided'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Brokerage:</td>
                <td style="padding: 8px 0; color: #0f172a;">${body.brokerage}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-weight: 500;">License #:</td>
                <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${body.license_number}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-weight: 500;">State:</td>
                <td style="padding: 8px 0; color: #0f172a;">${body.state}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Submitted:</td>
                <td style="padding: 8px 0; color: #0f172a;">${new Date().toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'full', timeStyle: 'short' })} EST</td>
              </tr>
            </table>
          </div>
          
          <div style="text-align: center; margin: 25px 0;">
            <a href="${ADMIN_PANEL_URL}" target="_blank" style="display: inline-block; background: #0E56F5; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
              📋 View in Admin Panel
            </a>
          </div>
          
          <div style="background: #eff6ff; border-left: 4px solid #0E56F5; padding: 15px 20px; margin: 25px 0; border-radius: 0 8px 8px 0;">
            <p style="margin: 0; color: #1e40af; font-size: 14px;">
              <strong>Early Access:</strong> This agent registered for pre-launch access. They will appear as "pending" in your Admin Panel.
            </p>
          </div>
          
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
          
          <p style="color: #94a3b8; font-size: 12px; margin: 0; text-align: center;">
            AllAgentConnect Admin Notification
          </p>
        </div>
      </body>
      </html>
    `;

    try {
      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "AllAgentConnect <hello@mail.allagentconnect.com>",
          reply_to: "hello@allagentconnect.com",
          to: [ADMIN_EMAIL],
          subject: `🚀 Early Access Request — ${body.first_name} ${body.last_name}`,
          html: adminEmailHtml,
        }),
      });

      if (!emailRes.ok) {
        console.error("Failed to send admin notification:", await emailRes.json());
      } else {
        console.log("Admin notification sent for early access:", normalizedEmail);
      }
    } catch (emailErr) {
      console.error("Email error:", emailErr);
      // Don't fail the request if email fails - the registration was successful
    }

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
