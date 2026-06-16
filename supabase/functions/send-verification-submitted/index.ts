import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { buildAacEmail } from "../_shared/aacEmailTemplate.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const ADMIN_EMAIL = "chris@allagentconnect.com";
const ADMIN_PANEL_URL = "https://allagentconnect.com/admin/approvals";

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

const stateLicenseLookupUrls: Record<string, string> = {
  MA: "https://www.mass.gov/orgs/board-of-registration-of-real-estate-brokers-and-salespersons",
  CT: "https://www.elicense.ct.gov/",
  RI: "https://dbr.ri.gov/divisions/commercial-licensing",
  NH: "https://www.oplc.nh.gov/real-estate-commission",
  ME: "https://www.maine.gov/pfr/professionallicensing/",
  VT: "https://sos.vermont.gov/opr/",
  NY: "https://appext20.dos.ny.gov/nydos/selSearchType.do",
  NJ: "https://newjersey.mylicense.com/verification/",
  PA: "https://www.pals.pa.gov/",
};

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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, firstName, lastName, licenseState, licenseNumber }: VerificationEmailRequest = await req.json();
    console.log(`Processing verification request for: ${email}`);

    const stateName = stateNames[licenseState] || licenseState;
    const licenseVerifyUrl = stateLicenseLookupUrls[licenseState] || "";

    const detailsTable = `
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;margin:16px 0;">
        <tr><td style="padding:12px 16px;color:#64748b;font-size:14px;">Agent Name:</td><td style="padding:12px 16px;color:#0f172a;font-weight:600;font-size:14px;">${firstName} ${lastName}</td></tr>
        <tr><td style="padding:12px 16px;color:#64748b;font-size:14px;">Email:</td><td style="padding:12px 16px;font-size:14px;"><a href="mailto:${email}" style="color:#0E56F5;text-decoration:none;">${email}</a></td></tr>
        <tr><td style="padding:12px 16px;color:#64748b;font-size:14px;">License #:</td><td style="padding:12px 16px;color:#0f172a;font-weight:600;font-size:14px;">${licenseNumber}</td></tr>
        <tr><td style="padding:12px 16px;color:#64748b;font-size:14px;">State:</td><td style="padding:12px 16px;color:#0f172a;font-size:14px;">${stateName}</td></tr>
        <tr><td style="padding:12px 16px;color:#64748b;font-size:14px;">Submitted:</td><td style="padding:12px 16px;color:#0f172a;font-size:14px;">${new Date().toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'full', timeStyle: 'short' })} EST</td></tr>
      </table>
      ${licenseVerifyUrl ? `<p style="margin:8px 0 0;font-size:13px;"><a href="${licenseVerifyUrl}" target="_blank" style="color:#0E56F5;text-decoration:none;">Verify ${stateName} license →</a></p>` : ""}`;

    const adminEmailHtml = buildAacEmail({
      headline: "New Agent License Verification",
      preheader: `New verification: ${firstName} ${lastName} — ${stateName} #${licenseNumber}`,
      body: detailsTable,
      ctaLabel: "Review in Admin Panel",
      ctaUrl: ADMIN_PANEL_URL,
    });

    const adminEmailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: (Deno.env.get("TRANSACTIONAL_FROM") || "All Agent Connect <hello@allagentconnect.com>"),
        reply_to: "chris@allagentconnect.com",
        to: [ADMIN_EMAIL],
        subject: `New License Verification — ${firstName} ${lastName}`,
        html: adminEmailHtml,
      }),
    });

    const adminData = await adminEmailRes.json();
    
    if (!adminEmailRes.ok) {
      console.error("Resend API error (admin email):", adminData);
      throw new Error(adminData.message || "Failed to send admin notification");
    }

    console.log("Admin notification email sent successfully:", adminData);

    return new Response(JSON.stringify({ success: true, adminData }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-verification-submitted function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
