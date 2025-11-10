import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface BulkEmailRequest {
  recipients: Array<{ email: string; name: string }>;
  subject: string;
  message: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { recipients, subject, message }: BulkEmailRequest = await req.json();

    console.log(`Sending bulk email to ${recipients.length} recipients`);

    if (!recipients || recipients.length === 0) {
      throw new Error("No recipients provided");
    }

    if (!subject || !message) {
      throw new Error("Subject and message are required");
    }

    // Send emails individually to avoid spam filters and personalize
    const results = await Promise.allSettled(
      recipients.map(async (recipient) => {
        const emailResponse = await resend.emails.send({
          from: "Agent Connect <onboarding@resend.dev>",
          to: [recipient.email],
          subject: subject,
          html: `
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                  body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                  }
                  .header {
                    border-bottom: 2px solid #2563eb;
                    padding-bottom: 20px;
                    margin-bottom: 30px;
                  }
                  .content {
                    white-space: pre-wrap;
                    margin-bottom: 30px;
                  }
                  .footer {
                    border-top: 1px solid #e5e7eb;
                    padding-top: 20px;
                    margin-top: 30px;
                    font-size: 14px;
                    color: #6b7280;
                  }
                </style>
              </head>
              <body>
                <div class="header">
                  <h1 style="color: #2563eb; margin: 0;">Agent Connect</h1>
                </div>
                
                <div class="content">
                  <p>Hello ${recipient.name},</p>
                  <p>${message.replace(/\n/g, '<br>')}</p>
                </div>
                
                <div class="footer">
                  <p>This email was sent from Agent Connect</p>
                </div>
              </body>
            </html>
          `,
        });

        console.log(`Email sent to ${recipient.email}:`, emailResponse);
        return emailResponse;
      })
    );

    // Count successes and failures
    const successes = results.filter((r) => r.status === "fulfilled").length;
    const failures = results.filter((r) => r.status === "rejected").length;

    console.log(`Bulk email results: ${successes} successes, ${failures} failures`);

    if (failures > 0) {
      const failedEmails = results
        .map((r, i) => (r.status === "rejected" ? recipients[i].email : null))
        .filter(Boolean);
      
      console.error("Failed emails:", failedEmails);
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent: successes,
        failed: failures,
        total: recipients.length,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in send-bulk-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
