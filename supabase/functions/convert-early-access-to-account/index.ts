import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ConvertRequest {
  earlyAccessId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  licenseState?: string;
  licenseNumber?: string;
  brokerage?: string;
}

// Generate a secure random password
function generateSecurePassword(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
  let password = "";
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  for (let i = 0; i < 16; i++) {
    password += chars[array[i] % chars.length];
  }
  return password;
}

// Build password setup email HTML
function buildPasswordSetupEmailHtml(firstName: string, resetLink: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to AllAgentConnect</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc;">
    <tr>
      <td align="center" style="padding: 48px 24px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 520px;">
          
          <!-- Content -->
          <tr>
            <td style="padding: 0;">
              <p style="font-size: 15px; color: #334155; line-height: 1.7; margin: 0 0 20px 0;">
                Hi ${firstName},
              </p>
              
              <p style="font-size: 15px; color: #334155; line-height: 1.7; margin: 0 0 20px 0;">
                Great news! Your real estate license has been verified, and your AllAgentConnect account is ready.
              </p>
              
              <p style="font-size: 15px; color: #334155; line-height: 1.7; margin: 0 0 20px 0;">
                Click the button below to set your password and get started:
              </p>
              
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 32px 0;">
                <tr>
                  <td style="background-color: #0E56F5; border-radius: 8px;">
                    <a href="${resetLink}" style="display: inline-block; padding: 14px 32px; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 15px;">
                      Set Your Password
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="font-size: 13px; color: #64748b; line-height: 1.7; margin: 0 0 20px 0;">
                Or copy this link: <a href="${resetLink}" style="color: #0E56F5;">${resetLink}</a>
              </p>
              
              <p style="font-size: 15px; color: #334155; line-height: 1.7; margin: 0 0 20px 0;">
                If you have any questions, reach us anytime at <a href="mailto:hello@allagentconnect.com" style="color: #334155;">hello@allagentconnect.com</a>.
              </p>
              
              <p style="font-size: 15px; color: #64748b; line-height: 1.7; margin: 32px 0 0 0;">
                —<br>
                AllAgentConnect
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: ConvertRequest = await req.json();
    const { earlyAccessId, email, firstName, lastName, phone, licenseState, licenseNumber, brokerage } = body;

    if (!email || !firstName || !lastName) {
      return new Response(
        JSON.stringify({ error: "email, firstName, and lastName are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Converting early access user to full account: ${email}`);

    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Check if user already exists in auth.users
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());

    if (existingUser) {
      console.log(`User ${email} already exists in auth.users, skipping account creation`);
      
      // Just update their agent_settings to verified status
      const { error: settingsError } = await supabaseAdmin
        .from("agent_settings")
        .upsert({
          user_id: existingUser.id,
          agent_status: "verified",
          verified_at: new Date().toISOString(),
          license_state: licenseState || null,
          license_number: licenseNumber || null,
        }, { onConflict: "user_id" });

      if (settingsError) {
        console.error("Error updating agent_settings:", settingsError);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          userId: existingUser.id, 
          message: "User already exists, status updated to verified" 
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Generate temporary password
    const tempPassword = generateSecurePassword();

    // Create new user in auth.users
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        phone: phone || null,
      },
    });

    if (createError || !newUser?.user) {
      console.error("Error creating user:", createError);
      return new Response(
        JSON.stringify({ error: createError?.message || "Failed to create user" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const userId = newUser.user.id;
    console.log(`Created auth user: ${userId}`);

    // Generate AAC ID
    const { data: aacIdData } = await supabaseAdmin.rpc("generate_aac_id");
    const aacId = aacIdData || `AAC-${Date.now()}`;

    // Create agent_profiles record
    const { error: profileError } = await supabaseAdmin
      .from("agent_profiles")
      .insert({
        id: userId,
        email,
        first_name: firstName,
        last_name: lastName,
        phone: phone || null,
        company: brokerage || null,
        aac_id: aacId,
      });

    if (profileError) {
      console.error("Error creating agent_profiles:", profileError);
      // Continue anyway - the trigger should have created it
    }

    // Create agent_settings record with verified status
    const { error: settingsError } = await supabaseAdmin
      .from("agent_settings")
      .upsert({
        user_id: userId,
        agent_status: "verified",
        verified_at: new Date().toISOString(),
        license_state: licenseState || null,
        license_number: licenseNumber || null,
        early_access: true,
        approval_email_sent: true,
      }, { onConflict: "user_id" });

    if (settingsError) {
      console.error("Error creating agent_settings:", settingsError);
    }

    // Assign agent role
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({
        user_id: userId,
        role: "agent",
      });

    if (roleError && !roleError.message?.includes("duplicate")) {
      console.error("Error assigning agent role:", roleError);
    }

    // Generate password reset link
    const { data: resetData, error: resetError } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: {
        redirectTo: "https://allagentconnect.com/auth/callback",
      },
    });

    if (resetError || !resetData?.properties?.action_link) {
      console.error("Error generating reset link:", resetError);
      return new Response(
        JSON.stringify({ 
          success: true, 
          userId, 
          warning: "Account created but password reset email failed. Use manual reset." 
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const resetLink = resetData.properties.action_link;
    console.log(`Generated password reset link for ${email}`);

    // Send password setup email via Resend
    const emailHtml = buildPasswordSetupEmailHtml(firstName, resetLink);
    
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "AllAgentConnect <hello@mail.allagentconnect.com>",
        reply_to: "hello@allagentconnect.com",
        to: [email],
        subject: "Welcome to AllAgentConnect - Set Your Password",
        html: emailHtml,
      }),
    });

    const emailData = await emailRes.json();

    if (!emailRes.ok) {
      console.error("Resend API error:", emailData);
      return new Response(
        JSON.stringify({ 
          success: true, 
          userId, 
          warning: "Account created but welcome email failed. Use manual password reset." 
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Sent welcome email to ${email}:`, emailData);

    return new Response(
      JSON.stringify({ 
        success: true, 
        userId,
        emailId: emailData.id,
        message: "Account created and welcome email sent" 
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error in convert-early-access-to-account:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
