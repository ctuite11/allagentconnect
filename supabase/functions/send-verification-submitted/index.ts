import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface VerificationEmailRequest {
  email: string;
  firstName: string;
  lastName: string;
  licenseState: string;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, firstName, lastName, licenseState }: VerificationEmailRequest = await req.json();

    console.log(`Sending verification submitted email to: ${email}`);

    // Get state full name
    const stateNames: Record<string, string> = {
      MA: "Massachusetts",
      CT: "Connecticut",
      RI: "Rhode Island",
      NH: "New Hampshire",
      ME: "Maine",
      VT: "Vermont",
      NY: "New York",
      NJ: "New Jersey",
      PA: "Pennsylvania",
    };
    const stateName = stateNames[licenseState] || licenseState;

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">AllAgentConnect</h1>
        </div>
        
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <h2 style="color: #1e3a5f; margin-top: 0;">Hi ${firstName},</h2>
          
          <p>Thanks for submitting your real estate license for verification. We're excited to have you join AllAgentConnect — the agent-only network built for real collaboration.</p>
          
          <div style="background: #f8fafc; border-left: 4px solid #1e3a5f; padding: 15px 20px; margin: 25px 0; border-radius: 0 8px 8px 0;">
            <p style="margin: 0; font-weight: 600; color: #1e3a5f;">What happens next:</p>
            <ul style="margin: 10px 0 0 0; padding-left: 20px; color: #64748b;">
              <li>Our team will review your ${stateName} license information</li>
              <li>We verify your credentials with the state licensing board</li>
              <li>${licenseState === 'MA' ? 'Massachusetts verifications are typically completed within 24 hours' : 'Verifications are typically completed within 24 hours'}</li>
            </ul>
          </div>
          
          <p><strong>We'll send you another email once your license is verified</strong> and you have full access to the platform.</p>
          
          <p style="color: #64748b; font-size: 14px; margin-top: 30px;">
            If you have any questions in the meantime, just reply to this email.
          </p>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">
            © ${new Date().getFullYear()} AllAgentConnect. All rights reserved.<br>
            This email was sent to ${email} because you signed up for AllAgentConnect.
          </p>
        </div>
      </body>
      </html>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "AllAgentConnect <noreply@allagentconnect.com>",
        to: [email],
        subject: "We received your license verification — welcome to AllAgentConnect",
        html: emailHtml,
      }),
    });

    const data = await res.json();
    
    if (!res.ok) {
      console.error("Resend API error:", data);
      throw new Error(data.message || "Failed to send email");
    }

    console.log("Verification submitted email sent successfully:", data);

    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-verification-submitted function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
