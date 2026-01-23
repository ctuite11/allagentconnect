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

function buildLockedEmailHtml(name: string): string {
  const greeting = name ? `Hi ${name},` : "Hi,";
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to AllAgentConnect</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f8fafc;">
    <tr>
      <td align="center" style="padding:48px 24px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background-color:#ffffff;border-radius:8px;">
          <!-- Header: Plain text only -->
          <tr>
            <td style="padding:32px 40px 24px;text-align:center;">
              <p style="margin:0;font-size:20px;font-weight:600;color:#0F172A;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">AllAgentConnect</p>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:0 40px 32px;">
              <h2 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#0F172A;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Welcome — You're Almost In</h2>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
                ${greeting}
              </p>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
                Thanks for signing up for AllAgentConnect.
              </p>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#334155;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
                Your account is currently <strong>pending verification</strong>. We review new accounts quickly to keep the network agent-only and deal-focused. You'll receive an email as soon as you're approved.
              </p>
              <p style="margin:0;font-size:14px;line-height:1.6;color:#334155;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
                Questions? Just reply to this email.
              </p>
            </td>
          </tr>
          <!-- Footer: Plain text only -->
          <tr>
            <td style="padding:24px 40px;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0 0 4px;font-size:13px;line-height:1.5;color:#64748B;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">AllAgentConnect</p>
              <p style="margin:0;font-size:13px;line-height:1.5;color:#64748B;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">hello@allagentconnect.com</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

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

    const from = process.env.EMAIL_FROM || "AllAgentConnect <onboarding@resend.dev>";

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

— AllAgentConnect
mail.allagentconnect.com`;

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
        html: buildLockedEmailHtml(name),
        text,
      }),
    });

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      console.error("[send-pending-approval-email] Resend error:", {
        status: resp.status,
        data,
      });
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({ ok: false, error: (data as any)?.message || "Resend error", data }),
      };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, data }) };
  } catch (e: any) {
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: e?.message || String(e) }) };
  }
};
