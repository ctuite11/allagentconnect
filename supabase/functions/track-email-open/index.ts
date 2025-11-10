import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// 1x1 transparent pixel
const transparentPixel = new Uint8Array([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00,
  0x01, 0x00, 0x80, 0x00, 0x00, 0xff, 0xff, 0xff,
  0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x01, 0x00,
  0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00,
  0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44,
  0x01, 0x00, 0x3b,
]);

const handler = async (req: Request): Promise<Response> => {
  try {
    const url = new URL(req.url);
    const emailSendId = url.searchParams.get("id");

    if (!emailSendId) {
      console.log("No email send ID provided");
      return new Response(transparentPixel, {
        headers: { "Content-Type": "image/gif" },
      });
    }

    // Get user agent and IP
    const userAgent = req.headers.get("user-agent") || "";
    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0] || 
                      req.headers.get("x-real-ip") || "";

    // Record the open
    const { error } = await supabase.from("email_opens").insert({
      email_send_id: emailSendId,
      user_agent: userAgent,
      ip_address: ipAddress,
    });

    if (error) {
      console.error("Error recording email open:", error);
    } else {
      console.log(`Recorded email open for send ID: ${emailSendId}`);
    }

    // Always return the tracking pixel
    return new Response(transparentPixel, {
      headers: { 
        "Content-Type": "image/gif",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });
  } catch (error: any) {
    console.error("Error in track-email-open function:", error);
    // Still return pixel even on error
    return new Response(transparentPixel, {
      headers: { "Content-Type": "image/gif" },
    });
  }
};

serve(handler);
