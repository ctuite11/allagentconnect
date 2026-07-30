import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
import { buildAacEmail } from "../_shared/aacEmailTemplate.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface WelcomeEmailRequest {
  email: string;
  firstName: string;
  lastName: string;
}

const getFrontendUrl = (): string => {
  return Deno.env.get("FRONTEND_URL") || "https://allagentconnect.com";
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, firstName, lastName }: WelcomeEmailRequest = await req.json();
    console.log("Sending welcome email to:", email);

    const fullName = `${firstName} ${lastName}`;
    const frontendUrl = getFrontendUrl();

    const html = buildAacEmail({
      headline: "Welcome to All Agent Connect",
      preheader: `Welcome, ${firstName}! Your account is ready.`,
      body: `
        <p style="margin:0 0 16px;">Hi ${fullName},</p>
        <p style="margin:0 0 16px;">Thank you for joining All Agent Connect. Your account is set up and ready to go.</p>
        <p style="margin:0;">Browse the agent network, manage your listings, and connect with verified agents in your market.</p>`,
      ctaLabel: "Get Started",
      ctaUrl: `${frontendUrl}/browse`,
    });

    // Route through queued email_jobs + email-worker (proven-inboxing pattern).
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Server misconfigured: missing Supabase service credentials");
    }
    const admin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: jobRow, error: enqueueError } = await admin
      .from("email_jobs")
      .insert({
        stream: "transactional",
        payload: {
          provider: "resend",
          template: "welcome-email",
          to: email,
          subject: "Welcome to All Agent Connect",
          html,
        },
      })
      .select("id")
      .single();

    if (enqueueError) {
      console.error("[send-welcome-email] enqueue failed:", enqueueError);
      throw enqueueError;
    }

    void fetch(`${supabaseUrl}/functions/v1/kick-email-queue`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${supabaseServiceKey}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    }).catch((err) => {
      console.warn("[send-welcome-email] kick-email-queue failed (will run on schedule):", err);
    });

    console.log("Welcome email enqueued:", jobRow?.id);

    return new Response(JSON.stringify({ enqueued: true, jobId: jobRow?.id }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-welcome-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
