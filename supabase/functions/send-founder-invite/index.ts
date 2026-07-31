import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface FounderInviteRequest {
  recipientEmail: string;
  recipientName?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!jwt) {
      return new Response(JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: userError } = await userClient.auth.getUser(jwt);
    if (userError || !caller) {
      return new Response(JSON.stringify({ error: "Invalid session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: isAdmin } = await userClient.rpc("has_role", {
      _user_id: caller.id, _role: "admin",
    });
    if (isAdmin !== true) {
      return new Response(JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body: FounderInviteRequest = await req.json();
    const recipientEmail = (body.recipientEmail || "").trim().toLowerCase();
    const recipientName = (body.recipientName || "").trim();
    if (!recipientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
      return new Response(JSON.stringify({ error: "Valid recipient email required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const idempotencyKey = `founder-invite-1to1:${recipientEmail}`;

    const { error: insertError } = await supabaseAdmin
      .from("email_jobs")
      .insert({
        stream: "transactional",
        idempotency_key: idempotencyKey,
        payload: {
          provider: "resend",
          template: "founder-invite-1to1",
          to: recipientEmail,
          subject: "An invitation to become an All Agent Connect Founding Partner",
          reply_to: "hello@allagentconnect.com",
          variables: {
            recipientName,
            sentBy: caller.email,
            sentByUserId: caller.id,
          },
        },
      });

    if (insertError) {
      // Duplicate (idempotency) — treat as success
      if ((insertError as { code?: string }).code === "23505") {
        console.log(`[send-founder-invite] duplicate suppressed for ${recipientEmail}`);
        return new Response(JSON.stringify({ success: true, queued: 0, recipient: recipientEmail, duplicate: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      console.error("[send-founder-invite] enqueue failed:", insertError);
      return new Response(JSON.stringify({ error: "Failed to queue email" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log(`[send-founder-invite] queued for ${recipientEmail} by ${caller.email}`);
    return new Response(JSON.stringify({ success: true, queued: 1, recipient: recipientEmail }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("[send-founder-invite] error:", e);
    return new Response(JSON.stringify({ error: e?.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
};

serve(handler);