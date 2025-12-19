import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const ADMIN_EMAIL = "chris@allagentconnect.com";

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
  licenseNumber: string;
}

// State license lookup URLs
const stateLicenseLookupUrls: Record<string, string> = {
  MA: "https://www.mass.gov/how-to/look-up-a-real-estate-license",
  CT: "https://www.elicense.ct.gov/",
  RI: "https://dbr.ri.gov/divisions/commercial-licensing",
  NH: "https://www.oplc.nh.gov/real-estate-commission",
  ME: "https://www.maine.gov/pfr/professionallicensing/",
  VT: "https://sos.vermont.gov/opr/",
  NY: "https://appext20.dos.ny.gov/nydos/selSearchType.do",
  NJ: "https://newjersey.mylicense.com/verification/",
  PA: "https://www.pals.pa.gov/",
};

// State full names
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

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, firstName, lastName, licenseState, licenseNumber }: VerificationEmailRequest = await req.json();

    console.log(`Sending verification submitted email to: ${email}`);

    const stateName = stateNames[licenseState] || licenseState;
    const licenseVerifyUrl = stateLicenseLookupUrls[licenseState] || "";

    // Email to user - new premium copy
    const userEmailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.7; color: #334155; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
        <div style="background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.04);">
          
          <div style="padding: 32px 32px 24px 32px; border-bottom: 1px solid #f1f5f9;">
            <div style="font-size: 20px; font-weight: 600;">
              <span style="color: #0f172a;">AllAgent</span><span style="color: #94a3b8;">Connect</span>
            </div>
          </div>
          
          <div style="padding: 32px;">
            <p style="margin: 0 0 20px 0; font-size: 16px;">Hi ${firstName},</p>
            
            <p style="margin: 0 0 20px 0;">Thanks for your interest in AllAgentConnect — the agent-only network built for direct communication and off-market collaboration.</p>
            
            <p style="margin: 0 0 20px 0;">We've received your license and profile details and are reviewing them now to keep the platform trusted and verified.</p>
            
            <p style="margin: 0 0 24px 0;"><strong style="color: #0f172a;">You'll get an email the moment you're approved.</strong></p>
            
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 28px 0;">
            
            <p style="margin: 0; color: #64748b; font-size: 14px;">
              — AllAgentConnect Team
            </p>
          </div>
          
          <div style="padding: 20px 32px; background: #f8fafc; border-top: 1px solid #f1f5f9;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0; text-align: center;">
              © ${new Date().getFullYear()} AllAgentConnect. All rights reserved.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Email to admin for verification
    const adminEmailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">🔔 New Verification Request</h1>
        </div>
        
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
          <h2 style="color: #0f172a; margin-top: 0;">New Agent License Verification</h2>
          
          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Agent Name:</td>
                <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${firstName} ${lastName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Email:</td>
                <td style="padding: 8px 0; color: #0f172a;"><a href="mailto:${email}" style="color: #2563eb;">${email}</a></td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-weight: 500;">License #:</td>
                <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${licenseNumber}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-weight: 500;">State:</td>
                <td style="padding: 8px 0; color: #0f172a;">${stateName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Submitted:</td>
                <td style="padding: 8px 0; color: #0f172a;">${new Date().toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'full', timeStyle: 'short' })} EST</td>
              </tr>
            </table>
          </div>
          
          ${licenseVerifyUrl ? `
          <div style="text-align: center; margin: 25px 0;">
            <a href="${licenseVerifyUrl}" target="_blank" style="display: inline-block; background: #0f172a; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
              🔗 Verify ${stateName} License
            </a>
          </div>
          ` : ''}
          
          <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px 20px; margin: 25px 0; border-radius: 0 8px 8px 0;">
            <p style="margin: 0; color: #92400e; font-size: 14px;">
              <strong>Action Required:</strong> Once verified, update this agent's <code>agent_status</code> to <code>'verified'</code> in the database.
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

    // Send email to user
    const userEmailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "AllAgentConnect <hello@allagentconnect.com>",
        to: [email],
        subject: "Thanks for requesting access to AllAgentConnect",
        html: userEmailHtml,
      }),
    });

    const userData = await userEmailRes.json();
    
    if (!userEmailRes.ok) {
      console.error("Resend API error (user email):", userData);
      throw new Error(userData.message || "Failed to send user email");
    }

    console.log("User verification email sent successfully:", userData);

    // Send email to admin
    const adminEmailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "AllAgentConnect <hello@allagentconnect.com>",
        to: [ADMIN_EMAIL],
        subject: `🔔 New License Verification — ${firstName} ${lastName}`,
        html: adminEmailHtml,
      }),
    });

    const adminData = await adminEmailRes.json();
    
    if (!adminEmailRes.ok) {
      console.error("Resend API error (admin email):", adminData);
      // Don't throw here - user email already sent successfully
    } else {
      console.log("Admin notification email sent successfully:", adminData);
    }

    return new Response(JSON.stringify({ success: true, userData, adminData }), {
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
