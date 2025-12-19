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

    // Email to user
    const userEmailHtml = `
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

    // Email to admin for verification
    const adminEmailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">🔔 New Verification Request</h1>
        </div>
        
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <h2 style="color: #1e3a5f; margin-top: 0;">New Agent License Verification</h2>
          
          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Agent Name:</td>
                <td style="padding: 8px 0; color: #1e3a5f; font-weight: 600;">${firstName} ${lastName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Email:</td>
                <td style="padding: 8px 0; color: #1e3a5f;"><a href="mailto:${email}" style="color: #2563eb;">${email}</a></td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-weight: 500;">License #:</td>
                <td style="padding: 8px 0; color: #1e3a5f; font-weight: 600;">${licenseNumber}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-weight: 500;">State:</td>
                <td style="padding: 8px 0; color: #1e3a5f;">${stateName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Submitted:</td>
                <td style="padding: 8px 0; color: #1e3a5f;">${new Date().toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'full', timeStyle: 'short' })} EST</td>
              </tr>
            </table>
          </div>
          
          ${licenseVerifyUrl ? `
          <div style="text-align: center; margin: 25px 0;">
            <a href="${licenseVerifyUrl}" target="_blank" style="display: inline-block; background: #1e3a5f; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
              🔗 Verify ${stateName} License
            </a>
          </div>
          ` : ''}
          
          <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px 20px; margin: 25px 0; border-radius: 0 8px 8px 0;">
            <p style="margin: 0; color: #92400e; font-size: 14px;">
              <strong>Action Required:</strong> Once verified, update this agent's <code>agent_status</code> to <code>'verified'</code> in the database.
            </p>
          </div>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          
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
        from: "AllAgentConnect <noreply@allagentconnect.com>",
        to: [email],
        subject: "We received your license verification — welcome to AllAgentConnect",
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
        from: "AllAgentConnect <noreply@allagentconnect.com>",
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
