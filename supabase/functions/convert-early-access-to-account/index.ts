import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AAC_PUBLIC_URL } from "../_shared/aacPublicUrl.ts";
import { findDeletedAgent } from "../_shared/checkDeletedAgent.ts";

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
  skipEmail?: boolean;
  /**
   * Phase 4 guardrail — set to true only after the admin has explicitly
   * confirmed the "previously deleted" dialog in the UI.
   */
  acknowledgeDeleted?: boolean;
  /**
   * @deprecated Ignored for status writes. Convert never marks non-activated
   * agents verified — admin-verify-agent owns that after license-verified enqueue.
   * Kept for API compatibility with admin-verify-agent callers.
   */
  deferVerifiedStatus?: boolean;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  reset_at: string;
  current_count: number;
}

async function checkRateLimit(
  supabase: any,
  key: string,
  windowSeconds: number,
  limit: number
): Promise<RateLimitResult> {
  const { data, error } = await supabase.rpc('rate_limit_consume', {
    p_key: key,
    p_window_seconds: windowSeconds,
    p_limit: limit,
  });

  if (error) {
    console.error("[rate-limit] RPC error:", error);
    return { allowed: true, remaining: limit, reset_at: new Date().toISOString(), current_count: 0 };
  }

  return data as RateLimitResult;
}

function build429Response(resetAt: string): Response {
  const resetDate = new Date(resetAt);
  const retryAfter = Math.max(1, Math.ceil((resetDate.getTime() - Date.now()) / 1000));
  
  return new Response(JSON.stringify({ error: "Too many requests" }), {
    status: 429,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Retry-After": String(retryAfter),
      "X-RateLimit-Remaining": "0",
      "X-RateLimit-Reset": String(Math.floor(resetDate.getTime() / 1000)),
    },
  });
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

// Build premium AAC-branded password setup email HTML
function buildPasswordSetupEmailHtml(firstName: string, resetLink: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to AllAgentConnect</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f5f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 520px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 24px rgba(15, 23, 42, 0.06); border: 1px solid #e5e5e5;">
          
          <!-- Header with Logo -->
          <tr>
            <td align="center" style="padding: 32px 40px 24px;">
              <img src="https://allagentconnect.com/brand/aac-globe.png" 
                   width="80" height="80" alt="AAC" 
                   style="display: block; margin: 0 auto 16px;" />
              <p style="margin: 0; font-size: 22px; font-weight: 600;">
                <span style="color: #0E56F5;">All Agent </span><span style="color: #94A3B8;">Connect</span>
              </p>
              <div style="width: 64px; height: 2px; background: #0E56F5; margin: 12px auto 0;"></div>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 8px 40px 40px;">
              <p style="font-size: 16px; color: #334155; line-height: 1.7; margin: 0 0 20px 0;">
                Hi ${firstName},
              </p>
              
              <p style="font-size: 16px; color: #334155; line-height: 1.7; margin: 0 0 8px 0;">
                <span style="color: #059669; font-weight: 600;">✓</span> Your license has been verified
              </p>
              
              <p style="font-size: 16px; color: #334155; line-height: 1.7; margin: 0 0 28px 0;">
                Your AllAgentConnect account is ready. Set your password to get started:
              </p>
              
              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 0 28px 0;">
                <tr>
                  <td align="center" style="background-color: #0F172A; border-radius: 8px;">
                    <a href="${resetLink}" style="display: inline-block; padding: 14px 32px; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 15px;">
                      Set Your Password
                    </a>
                  </td>
                </tr>
              </table>
              
              <!-- Fallback URL -->
              <p style="font-size: 13px; color: #64748b; margin: 0 0 8px 0;">
                Or copy this link:
              </p>
              <div style="background-color: #ffffff; border: 1px solid #e5e7eb; padding: 12px; border-radius: 6px; margin: 0 0 28px 0;">
                <p style="margin: 0; font-size: 12px; color: #475569; word-break: break-all; font-family: 'SF Mono', Monaco, 'Courier New', monospace;">
                  ${resetLink}
                </p>
              </div>
              
              <p style="font-size: 15px; color: #64748b; line-height: 1.7; margin: 0;">
                Questions? <a href="mailto:chris@allagentconnect.com" style="color: #334155; text-decoration: none;">chris@allagentconnect.com</a>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px; border-top: 1px solid #e5e5e5;">
              <p style="font-size: 13px; color: #94a3b8; margin: 0 0 8px 0; text-align: center;">
                AllAgentConnect &nbsp;•&nbsp; chris@allagentconnect.com
              </p>
              <p style="font-size: 11px; color: #94a3b8; margin: 0; text-align: center;">
                <a href="mailto:chris@allagentconnect.com?subject=Remove%20My%20Account&body=Please%20remove%20my%20account%20from%20AllAgentConnect." style="color: #94a3b8; text-decoration: underline;">Click here</a> to request account removal.
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
    // SECURITY (2026-07-30 incident): this endpoint creates confirmed auth
    // users and grants the agent role with the service-role client. It is an
    // ADMIN-ONLY action and must never be callable anonymously.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization required" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    {
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        { global: { headers: { Authorization: authHeader } } },
      );
      const gate = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        { auth: { autoRefreshToken: false, persistSession: false } },
      );
      const { data: userData, error: userErr } = await userClient.auth.getUser();
      if (userErr || !userData?.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      const { data: isAdmin } = await gate.rpc("has_role", {
        _user_id: userData.user.id,
        _role: "admin",
      });
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    const body: ConvertRequest = await req.json();
    const {
      earlyAccessId,
      email,
      firstName,
      lastName,
      phone,
      licenseState,
      licenseNumber,
      brokerage,
      skipEmail,
      acknowledgeDeleted,
      deferVerifiedStatus: _deferVerifiedStatus,
    } = body;

    // Never finalize verified here for non-activated agents. Canonical
    // admin-verify-agent enqueues license-verified then sets verified.
    void _deferVerifiedStatus;
    const statusForCreate = "pending";
    const verifiedAtForCreate: string | null = null;

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

    // Get IP for rate limiting
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
               req.headers.get("x-real-ip") || 
               "unknown";

    // Database-backed rate limiting: 5 conversions per minute per IP (admin action)
    const rateLimitKey = `route:convert-early-access|ip:${ip}`;
    const rateLimitResult = await checkRateLimit(supabaseAdmin, rateLimitKey, 60, 5);
    
    if (!rateLimitResult.allowed) {
      console.log(`[rate-limit] Blocked IP: ${ip}, count: ${rateLimitResult.current_count}`);
      return build429Response(rateLimitResult.reset_at);
    }

    // Phase 4 guardrail — block silent recreation of a previously-deleted
    // agent. Admin must acknowledge in the UI and resubmit with
    // { acknowledgeDeleted: true } to bypass.
    if (!acknowledgeDeleted) {
      const deletedMatch = await findDeletedAgent(supabaseAdmin, email);
      if (deletedMatch) {
        console.warn(
          "[convert-early-access] blocked previously-deleted agent:",
          email,
          deletedMatch.id,
        );
        return new Response(
          JSON.stringify({
            error:
              "This agent was previously deleted. Confirm in the UI to proceed.",
            code: "previously_deleted",
            match: deletedMatch,
          }),
          { status: 409, headers: { "Content-Type": "application/json", ...corsHeaders } },
        );
      }
    }

    // Check if user already exists in auth.users
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());

    if (existingUser) {
      console.log(`User ${email} already exists in auth.users, skipping account creation`);

      // Safety guard — admin-created agents (agent_status = 'invited') MUST
      // NOT be run through the Early Access conversion path. They complete
      // /agent-setup and self-activate.
      const { data: existingSettings } = await supabaseAdmin
        .from("agent_settings")
        .select("agent_status")
        .eq("user_id", existingUser.id)
        .maybeSingle();
      if (existingSettings?.agent_status === "invited") {
        return new Response(
          JSON.stringify({
            error:
              "This agent was created by an admin (Invited). They must complete /agent-setup to activate — no conversion needed.",
          }),
          { status: 409, headers: { "Content-Type": "application/json", ...corsHeaders } },
        );
      }

      // Update agent_settings — leave pending so admin-verify-agent can
      // enqueue License Verified before finalizing (unless already activated).
      const { data: existingActivated } = await supabaseAdmin
        .from("agent_settings")
        .select("account_activated_at, verified_at")
        .eq("user_id", existingUser.id)
        .maybeSingle();
      const alreadyActivated = Boolean(existingActivated?.account_activated_at);
      const { error: settingsError } = await supabaseAdmin
        .from("agent_settings")
        .upsert({
          user_id: existingUser.id,
          agent_status: alreadyActivated ? "verified" : statusForCreate,
          verified_at: alreadyActivated
            ? existingActivated?.verified_at || new Date().toISOString()
            : verifiedAtForCreate,
          license_state: licenseState || null,
          license_number: licenseNumber || null,
          approval_email_sent: false,
        }, { onConflict: "user_id" });

      if (settingsError) {
        console.error("Error updating agent_settings:", settingsError);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          userId: existingUser.id, 
          message: alreadyActivated
            ? "User already exists and is activated"
            : "User already exists, status left pending until activation email enqueues",
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

    // Create agent_settings — leave pending until admin-verify-agent
    // enqueues License Verified and finalizes.
    const { error: settingsError } = await supabaseAdmin
      .from("agent_settings")
      .upsert({
        user_id: userId,
        agent_status: statusForCreate,
        verified_at: verifiedAtForCreate,
        license_state: licenseState || null,
        license_number: licenseNumber || null,
        early_access: true,
        approval_email_sent: false,
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

    if (skipEmail) {
      console.log(`Skipping welcome email for ${email} (skipEmail=true)`);
      return new Response(
        JSON.stringify({
          success: true,
          userId,
          message: "Account created (welcome email skipped)",
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Generate password reset link — pinned to AAC (never DCMLS).
    const publicSiteUrl = AAC_PUBLIC_URL;
    const { data: resetData, error: resetError } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: {
        redirectTo: `${publicSiteUrl}/auth/callback`,
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
        from: (Deno.env.get("TRANSACTIONAL_FROM") || "All Agent Connect <hello@allagentconnect.com>"),
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
