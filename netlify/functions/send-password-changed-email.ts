import type { Handler } from "@netlify/functions";

const cors = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin || "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
});

interface PasswordChangedRequest {
  email: string;
}

const handler: Handler = async (event) => {
  const origin = event.headers.origin || event.headers.Origin || null;
  const headers = cors(origin);

  // Handle preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    console.error("[send-password-changed-email] Missing RESEND_API_KEY");
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Server configuration error" }) };
  }

  try {
    const { email }: PasswordChangedRequest = JSON.parse(event.body || "{}");

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid email" }) };
    }

    const cleanEmail = email.trim().toLowerCase();
    const from = process.env.EMAIL_FROM || "AllAgentConnect <onboarding@resend.dev>";
    const supportEmail = "support@allagentconnect.com";
    const currentTime = new Date().toLocaleString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    });

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from,
        to: [cleanEmail],
        subject: "Your AllAgentConnect Password Was Changed",
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
                background-color: #f4f4f4;
                margin: 0;
                padding: 0;
              }
              .container {
                max-width: 600px;
                margin: 40px auto;
                background-color: #ffffff;
                border-radius: 8px;
                overflow: hidden;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
              }
              .header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                padding: 40px 30px;
                text-align: center;
              }
              .header h1 {
                color: #ffffff;
                margin: 0;
                font-size: 28px;
                font-weight: 600;
              }
              .content {
                padding: 40px 30px;
              }
              .content h2 {
                color: #333;
                font-size: 22px;
                margin-top: 0;
                margin-bottom: 20px;
              }
              .content p {
                color: #666;
                font-size: 16px;
                margin-bottom: 20px;
              }
              .alert-box {
                background-color: #fef3cd;
                border: 1px solid #ffc107;
                border-radius: 6px;
                padding: 16px;
                margin: 20px 0;
              }
              .alert-box p {
                color: #856404;
                margin: 0;
                font-size: 14px;
              }
              .info-box {
                background-color: #f8f9fa;
                border-radius: 6px;
                padding: 16px;
                margin: 20px 0;
              }
              .info-box p {
                color: #666;
                margin: 0;
                font-size: 14px;
              }
              .footer {
                background-color: #f8f8f8;
                padding: 30px;
                text-align: center;
                color: #999;
                font-size: 14px;
              }
              .footer a {
                color: #667eea;
                text-decoration: none;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>All Agent Connect</h1>
              </div>
              
              <div class="content">
                <h2>Password Changed Successfully</h2>
                <p>The password for your All Agent Connect account was just changed.</p>
                
                <div class="info-box">
                  <p><strong>Account:</strong> ${cleanEmail}</p>
                  <p><strong>Time:</strong> ${currentTime}</p>
                </div>
                
                <div class="alert-box">
                  <p><strong>Didn't make this change?</strong></p>
                  <p>If you didn't change your password, please contact us immediately at <a href="mailto:${supportEmail}">${supportEmail}</a>. Your account may have been compromised.</p>
                </div>
                
                <p>You can now sign in with your new password.</p>
              </div>
              
              <div class="footer">
                <p>
                  <strong>All Agent Connect</strong><br>
                  Revolutionizing Real Estate Through Complete Transparency
                </p>
                <p>
                  Need help? <a href="mailto:${supportEmail}">Contact Support</a>
                </p>
              </div>
            </div>
          </body>
        </html>
        `,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json();
      console.error("[send-password-changed-email] Resend error:", errorData);
      return { statusCode: 500, headers, body: JSON.stringify({ error: "Failed to send email" }) };
    }

    console.log("[send-password-changed-email] Confirmation email sent to:", cleanEmail.substring(0, 3) + "***");

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true }),
    };
  } catch (error: any) {
    console.error("[send-password-changed-email] Error:", error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};

export { handler };