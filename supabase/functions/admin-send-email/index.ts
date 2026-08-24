// Admin-only ad-hoc email sender.
// Verifies the caller holds the `admin` role, then enqueues a single 1:1
// email into `email_jobs` and kicks the queue.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
import { buildAacEmail } from "../_shared/aacEmailTemplate.ts";
import { buildPersonalForwardEmailHtml } from "../_shared/buildPersonalForwardEmailHtml.ts";
import { resolveAacCtaUrl } from "../_shared/aacPublicUrl.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type TemplateKind = "plain" | "branded" | "personal-forward-invite";

interface AdminSendEmailRequest {
  to?: string;
  subject?: string;
  message?: string;
  template?: TemplateKind;
  ctaLabel?: string;
  ctaUrl?: string;
  replyTo?: string;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Plain-text message -> simple paragraphs (personal-note style). */
function textToParagraphs(message: string): string {
  return message
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map(
      (block) =>
        `<p style="margin:0 0 14px;">${escapeHtml(block).replaceAll("\n", "<br>")}</p>`,
    )
    .join("\n");
}

function buildPlainHtml(message: string, subject: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#ffffff;color:#111111;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;">
<div style="max-width:560px;margin:0 auto;padding:24px 20px;">
${textToParagraphs(message)}
</div>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: isAdmin, error: roleError } = await admin.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (roleError || isAdmin !== true) return json({ error: "Forbidden" }, 403);

    const body = (await req.json().catch(() => ({}))) as AdminSendEmailRequest;
    const to = (body.to ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return json({ error: "Invalid recipient email" }, 400);
    }

    const template: TemplateKind = body.template ?? "plain";
    const ctaUrl = resolveAacCtaUrl(
      body.ctaUrl,
      "/auth?mode=register&source=personal_forward",
    );

    let subject = (body.subject ?? "").trim();
    let html: string;

    if (template === "personal-forward-invite") {
      subject = subject || "You\u2019re invited to join All Agent Connect";
      html = buildPersonalForwardEmailHtml({ ctaUrl });
    } else {
      const message = (body.message ?? "").trim();
      if (!subject) return json({ error: "Subject is required" }, 400);
      if (!message) return json({ error: "Message is required" }, 400);

      html = template === "branded"
        ? buildAacEmail({
          headline: subject,
          preheader: message.slice(0, 120),
          body: textToParagraphs(message),
          ...(body.ctaLabel?.trim()
            ? { ctaLabel: body.ctaLabel.trim(), ctaUrl }
            : {}),
        })
        : buildPlainHtml(message, subject);
    }

    const replyTo = (body.replyTo ?? "").trim() || "chris@allagentconnect.com";

    const { data: job, error: insertError } = await admin
      .from("email_jobs")
      .insert({
        payload: {
          provider: "resend",
          template: template === "personal-forward-invite"
            ? "personal-forward-invite"
            : "admin-adhoc",
          to,
          subject,
          html,
          reply_to: replyTo,
        },
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("[admin-send-email] enqueue failed:", insertError);
      return json({ error: insertError.message }, 500);
    }

    void fetch(`${supabaseUrl}/functions/v1/kick-email-queue`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    }).catch((err) => {
      console.warn("[admin-send-email] kick-email-queue failed:", err);
    });

    console.log(`[admin-send-email] queued ${template} -> ${to} (job ${job?.id})`);
    return json({ success: true, jobId: job?.id, to, subject, template });
  } catch (err) {
    console.error("[admin-send-email] error:", err);
    return json({ error: (err as Error)?.message ?? "Unknown error" }, 500);
  }
});
