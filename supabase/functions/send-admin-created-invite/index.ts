import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
import { buildAdminCreatedInviteEmailHtml } from "../_shared/buildAdminCreatedInviteEmailHtml.ts";
import { AAC_PUBLIC_URL, resolveAacCtaUrl } from "../_shared/aacPublicUrl.ts";
import {
  ACTIVATION_TOKEN_TTL_DAYS,
  sha256Hex,
  signActivationToken,
} from "../_shared/activationTokens.ts";

/**
 * Admin-created agent setup invite (personal note from Chris).
 *
 * Trigger: fires ONLY when an admin creates an agent from the Admin panel
 * via `admin-create-user`. This is intentionally separate from the standard
 * License Verified email — it does NOT replace it for normal verified
 * agents flowing through the Pending → Verify path.
 *
 * Idempotency: 10-minute recency dedupe on template + recipient, mirroring
 * `send-license-verified-email`. Default key is
 * `admin-created-invite:<recipient>:<YYYYMMDD>`.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendRequest {
  to: string;
  firstName?: string;
  ctaUrl?: string;
  subject?: string;
  idempotencyKey?: string;
  userId?: string;
  acknowledgeDeleted?: boolean;
}

const DEFAULT_SUBJECT = "Chris Tuite invited you to All Agent Connect";
const REPLY_TO = "chris@allagentconnect.com";
const TEMPLATE_NAME = "admin-created-invite";

const FOOTER_AGENT = {
  firstName: "Chris",
  lastName: "Tuite",
  title: "Founder, All Agent Connect",
  company: null,
  email: "chris@allagentconnect.com",
  phone: "6178770519",
  headshotUrl:
    "https://qocduqtfbsevnhlgsfka.supabase.co/storage/v1/object/public/agent-headshots/1fc50da1-2664-4931-8cab-64e24dc5ed8c/headshot-1773973124574.jpg",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as SendRequest;
    const email = typeof body?.to === "string" ? body.to.trim() : "";

    if (!email || !email.includes("@")) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid recipient" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const subject = body.subject?.trim() || DEFAULT_SUBJECT;

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Server misconfigured: missing Supabase service credentials");
    }
    const admin = createClient(supabaseUrl, supabaseServiceKey);

    const recipientLc = email.toLowerCase();
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const idempotencyKey =
      (typeof body.idempotencyKey === "string" && body.idempotencyKey.trim()) ||
      `${TEMPLATE_NAME}:${recipientLc}:${today}`;

    // 10-minute recency dedupe
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: recent, error: recentErr } = await admin
      .from("email_jobs")
      .select("id")
      .eq("payload->>template", TEMPLATE_NAME)
      .eq("payload->>to", email)
      .gte("created_at", tenMinAgo)
      .order("created_at", { ascending: false })
      .limit(1);

    if (recentErr) {
      console.error("[send-admin-created-invite] dedupe lookup failed:", recentErr);
    } else if (recent && recent.length > 0) {
      console.log(`[send-admin-created-invite] deduped for ${email}`);
      return new Response(
        JSON.stringify({ success: true, deduped: true, jobId: recent[0].id }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    // ---------------------------------------------------------------
    // Preferred path: durable, AAC-owned 7-day activation token.
    //
    // The previous implementation embedded a raw Supabase recovery link,
    // which expires in ~1 hour and can be burned by corporate mail
    // scanners — invitees reliably hit "email link has expired". The
    // activation token is POST-redeemed, so neither problem applies.
    // ---------------------------------------------------------------
    let userId = typeof body.userId === "string" ? body.userId.trim() : "";
    if (!userId) {
      const res = await fetch(
        `${supabaseUrl}/auth/v1/admin/users?filter=${encodeURIComponent(recipientLc)}`,
        {
          headers: {
            Authorization: `Bearer ${supabaseServiceKey}`,
            apikey: supabaseServiceKey,
          },
        },
      );
      const found = await res.json().catch(() => null);
      const match = (found?.users as Array<{ id: string; email: string }> | undefined)?.find(
        (u) => u.email?.toLowerCase() === recipientLc,
      );
      userId = match?.id ?? "";
    }

    const secret = Deno.env.get("ACTIVATION_TOKEN_SECRET");

    if (!body.ctaUrl && userId && secret) {
      const tokenId = crypto.randomUUID();
      const expiresAt = new Date(
        Math.floor(Date.now() / 1000) * 1000 +
          ACTIVATION_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
      );
      const token = await signActivationToken(secret, {
        id: tokenId,
        userId,
        expiresAtEpoch: Math.floor(expiresAt.getTime() / 1000),
      });

      const { data: issued, error: issueErr } = await admin.rpc(
        "reissue_agent_activation_token",
        {
          p_id: tokenId,
          p_user_id: userId,
          p_token_hash: await sha256Hex(token),
          p_expires_at: expiresAt.toISOString(),
          p_subject: subject,
          p_reply_to: REPLY_TO,
          p_agent_name: body.firstName ?? null,
          p_allow_previously_deleted: body.acknowledgeDeleted === true,
        },
      );

      const status = (issued as { status?: string } | null)?.status ?? "unknown";
      const jobId = (issued as { job_id?: string } | null)?.job_id ?? null;

      if (!issueErr && (status === "created" || status === "deduped") && jobId) {
        // Re-brand the queued job as the personal note from Chris. The CTA URL
        // itself is still late-rendered by the worker from the token id, so the
        // plaintext token is never persisted.
        if (status === "created") {
          const { data: jobRow } = await admin
            .from("email_jobs")
            .select("payload")
            .eq("id", jobId)
            .maybeSingle();
          const basePayload = (jobRow?.payload ?? {}) as Record<string, unknown>;
          await admin
            .from("email_jobs")
            .update({
              payload: {
                ...basePayload,
                template: TEMPLATE_NAME,
                subject,
                reply_to: REPLY_TO,
                first_name: body.firstName ?? null,
              },
            })
            .eq("id", jobId);
        }

        void fetch(`${supabaseUrl}/functions/v1/kick-email-queue`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${supabaseServiceKey}`,
            "Content-Type": "application/json",
          },
          body: "{}",
        }).catch(() => {});

        return new Response(
          JSON.stringify({ success: true, jobId, status, tokenId }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
        );
      }

      console.error(
        "[send-admin-created-invite] activation issuance unavailable:",
        issueErr?.message ?? status,
      );
      return new Response(
        JSON.stringify({ success: false, status, error: "Could not issue setup link" }),
        { status: 409, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    // Explicit CTA override (admin-supplied) — plain enqueue, no token.
    const ctaUrl = body.ctaUrl
      ? resolveAacCtaUrl(body.ctaUrl, "/auth")
      : `${AAC_PUBLIC_URL}/auth`;

    const html = buildAdminCreatedInviteEmailHtml({
      ctaUrl,
      firstName: body.firstName,
      footerAgent: FOOTER_AGENT,
    });

    const { data: inserted, error } = await admin.from("email_jobs").insert({
      payload: {
        provider: "resend",
        template: TEMPLATE_NAME,
        to: email,
        subject,
        html,
        reply_to: REPLY_TO,
        idempotency_key: idempotencyKey,
      },
    }).select("id").maybeSingle();

    if (error) {
      console.error(`[send-admin-created-invite] enqueue failed for ${email}:`, error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    void fetch(`${supabaseUrl}/functions/v1/kick-email-queue`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${supabaseServiceKey}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    }).catch((err) => {
      console.warn("[send-admin-created-invite] kick-email-queue failed:", err);
    });

    return new Response(
      JSON.stringify({ success: true, jobId: inserted?.id }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (err: any) {
    console.error("[send-admin-created-invite] error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message ?? "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
};

serve(handler);