import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const handler = async (req: Request): Promise<Response> => {
  try {
    const url = new URL(req.url);
    const emailSendId = url.searchParams.get("id");
    const targetUrl = url.searchParams.get("url");

    if (!emailSendId || !targetUrl) {
      return new Response("Invalid request", { status: 400 });
    }

    // Get user agent and IP
    const userAgent = req.headers.get("user-agent") || "";
    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0] || 
                      req.headers.get("x-real-ip") || "";

    // Record the click
    const { error } = await supabase.from("email_clicks").insert({
      email_send_id: emailSendId,
      url: targetUrl,
      user_agent: userAgent,
      ip_address: ipAddress,
    });

    if (error) {
      console.error("Error recording email click:", error);
    } else {
      console.log(`Recorded click for send ID: ${emailSendId}, URL: ${targetUrl}`);
    }

    // Redirect to the actual URL
    return Response.redirect(targetUrl, 302);
  } catch (error: any) {
    console.error("Error in track-email-click function:", error);
    return new Response("Error tracking click", { status: 500 });
  }
};

serve(handler);
