import type { Handler } from "@netlify/functions";

const cors = (origin: string | undefined) => {
  const o = origin || "";
  const allowed =
    o === "https://allagentconnect.com" ||
    o.endsWith(".netlify.app") ||
    o === "http://localhost:5173";
  return {
    "Access-Control-Allow-Origin": allowed ? o : "https://allagentconnect.com",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
};

export const handler: Handler = async (event) => {
  const origin = event.headers.origin || event.headers.Origin;
  const headers = { "Content-Type": "application/json", ...cors(origin) };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ ok: false, error: "Method not allowed" }) };
  }

  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: "Missing RESEND_API_KEY" }) };
    }

    const from = process.env.EMAIL_FROM || "AllAgentConnect <no-reply@allagentconnect.com>";
    const appOrigin = process.env.APP_ORIGIN || "https://allagentconnect.com";

    const { email, firstName, lastName } = JSON.parse(event.body || "{}");
    if (!email) {
      return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: "Missing email" }) };
    }

    const name = [firstName, lastName].filter(Boolean).join(" ").trim();

    const subject = "Welcome to AllAgentConnect — You're Almost In";

    const text = `Hi${name ? " " + name : ""},

Thanks for signing up for AllAgentConnect.

Your account is pending verification. We review new accounts quickly to keep the network agent-only and deal-focused.
You'll receive an email as soon as you're approved.

In the meantime, you can reply to this email if you have questions.

— AllAgentConnect Team
${appOrigin}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to AllAgentConnect</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="min-height: 100vh;">
          <tr>
            <td align="center" style="padding: 40px 20px;">
              <table role="presentation" width="100%" style="max-width: 560px; background: #ffffff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <tr>
                  <td style="padding: 48px 40px;">
                    <!-- Logo/Header -->
                    <div style="text-align: center; margin-bottom: 32px;">
                      <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #0f172a; letter-spacing: -0.5px;">
                        AllAgentConnect
                      </h1>
                    </div>
                    
                    <!-- Main Content -->
                    <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: 600; color: #0f172a;">
                      Welcome to AllAgentConnect — You're Almost In
                    </h2>
                    
                    <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #334155;">
                      Hi${name ? " " + name : ""},
                    </p>
                    
                    <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #334155;">
                      Thanks for signing up for AllAgentConnect.
                    </p>
                    
                    <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #334155;">
                      Your account is currently <strong>pending verification</strong>. We review new accounts quickly to keep the network agent-only and deal-focused. You'll receive an email as soon as you're approved.
                    </p>
                    
                    <!-- Divider -->
                    <div style="border-top: 1px solid #e2e8f0; margin: 32px 0;"></div>
                    
                    <!-- Footer -->
                    <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #64748b;">
                      Questions? Just reply to this email.
                    </p>
                    <p style="margin: 16px 0 0; font-size: 14px; line-height: 1.5; color: #64748b;">
                      — The AllAgentConnect Team
                    </p>
                  </td>
                </tr>
              </table>
              
              <!-- Footer Link -->
              <p style="margin: 24px 0 0; font-size: 13px; color: #94a3b8;">
                <a href="${appOrigin}" style="color: #64748b; text-decoration: none;">${appOrigin.replace('https://', '')}</a>
              </p>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject,
        html,
        text,
      }),
    });

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return { statusCode: 502, headers, body: JSON.stringify({ ok: false, error: data?.message || "Resend error", data }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, data }) };
  } catch (e: any) {
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: e?.message || String(e) }) };
  }
};
