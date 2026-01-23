import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface HotSheetInviteRequest {
  invitedEmail: string;
  inviterName: string;
  hotSheetName: string;
  hotSheetLink: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { invitedEmail, inviterName, hotSheetName, hotSheetLink }: HotSheetInviteRequest = await req.json();

    console.log("[send-hot-sheet-invite] Enqueuing job for:", invitedEmail);

    const { error: insertError } = await supabase.from("email_jobs").insert({
      payload: {
        provider: "resend",
        template: "hot-sheet-invite",
        to: invitedEmail,
        subject: `${inviterName} shared a Hot Sheet with you`,
        variables: { inviterName, hotSheetName, hotSheetLink },
      },
    });

    if (insertError) throw insertError;

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("[send-hot-sheet-invite] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);