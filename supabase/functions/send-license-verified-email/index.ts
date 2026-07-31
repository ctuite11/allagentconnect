import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildLicenseVerifiedEmailHtml } from "../_shared/buildLicenseVerifiedEmailHtml.ts";
import { AAC_PUBLIC_URL, resolveAacCtaUrl, wrapSupabaseActionLinkForAac } from "../_shared/aacPublicUrl.ts";
import { findDeletedAgent } from "../_shared/checkDeletedAgent.ts";

/**
 * Idempotency contract
 * --------------------
 * - Callers MAY pass `idempotencyKey` to control dedupe behavior.
 * - Durable dedupe uses `email_jobs.idempotency_key` (unique partial index).
 *   Re-inserts with the same key return the existing job as `{ success, deduped, jobId }`.
 * - If omitted, default key is `license-verified:<recipient-lowercased>:<YYYYMMDD>`.
 * - A 10-minute recency check remains as a secondary guard for default day keys.
 * - Success requires a real job id (`successCount > 0`). HTTP 200 with
 *   `successCount: 0` is never returned for non-blocked failures (use 422).
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendRequest {
  to: string | string[];
  ctaUrl?: string;
  subject?: string;
  agentName?: string;
  idempotencyKey?: string;
  acknowledgeDeleted?: boolean;
}

const DEFAULT_SUBJECT = "Your license has been verified — welcome to All Agent Connect";
const SETUP_REDIRECT = `${AAC_PUBLIC_URL}/auth/callback?type=recovery&setup=1`;

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as SendRequest;
    const toList = Array.isArray(body?.to) ? body.to : body?.to ? [body.to] : [];
    const recipients = toList.filter((e) => typeof e === "string" && e.includes("@"));

    if (recipients.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "No valid recipients provided" }),
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

    async function resolveCtaForRecipient(email: string): Promise<string> {
      if (body.ctaUrl) {
        return resolveAacCtaUrl(body.ctaUrl, "/auth");
      }
      try {
        const { data, error } = await admin.auth.admin.generateLink({
          type: "recovery",
          email,
          options: { redirectTo: SETUP_REDIRECT },
        });
        const actionLink = data?.properties?.action_link;
        if (error || !actionLink) {
          console.error("[send-license-verified-email] generateLink failed:", error);
          return `${AAC_PUBLIC_URL}/auth`;
        }
        return wrapSupabaseActionLinkForAac(actionLink);
      } catch (err) {
        console.error("[send-license-verified-email] generateLink threw:", err);
        return `${AAC_PUBLIC_URL}/auth`;
      }
    }

    const footerAgent = {
      firstName: "Chris",
      lastName: "Tuite",
      title: "Founder",
      company: null,
      email: "chris@allagentconnect.com",
      phone: "6178770519",
      headshotUrl:
        "https://qocduqtfbsevnhlgsfka.supabase.co/storage/v1/object/public/agent-headshots/1fc50da1-2664-4931-8cab-64e24dc5ed8c/headshot-1773973124574.jpg",
    };
    const replyTo = "chris@allagentconnect.com";

    const results: Array<{
      email: string;
      success: boolean;
      error?: string;
      jobId?: string;
      deduped?: boolean;
    }> = [];

    for (const email of recipients) {
      const recipientLc = email.trim().toLowerCase();

      if (!body.acknowledgeDeleted) {
        const deletedMatch = await findDeletedAgent(admin, recipientLc);
        if (deletedMatch) {
          console.warn(
            "[send-license-verified-email] blocked previously-deleted agent:",
            recipientLc,
            deletedMatch.id,
          );
          results.push({
            email,
            success: false,
            error: "previously_deleted",
            // deno-lint-ignore no-explicit-any
            ...( { match: deletedMatch } as any ),
          });
          continue;
        }
      }

      const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const idempotencyKey =
        (typeof body.idempotencyKey === "string" && body.idempotencyKey.trim()) ||
        `license-verified:${recipientLc}:${today}`;

      // Durable dedupe: existing job with this idempotency_key wins forever.
      const { data: byKey, error: byKeyErr } = await admin
        .from("email_jobs")
        .select("id")
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();
      if (byKeyErr) {
        console.error("[send-license-verified-email] idempotency lookup failed:", byKeyErr);
      } else if (byKey?.id) {
        console.log(`[send-license-verified-email] deduped (idempotency_key) for ${email}`);
        results.push({ email, success: true, deduped: true, jobId: byKey.id });
        continue;
      }

      // Secondary: 10-minute recency for accidental double-clicks with distinct keys.
      const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { data: recent, error: recentErr } = await admin
        .from("email_jobs")
        .select("id")
        .eq("payload->>template", "license-verified")
        .eq("payload->>to", email)
        .gte("created_at", tenMinAgo)
        .order("created_at", { ascending: false })
        .limit(1);

      if (recentErr) {
        console.error("[send-license-verified-email] dedupe lookup failed:", recentErr);
      } else if (recent && recent.length > 0) {
        console.log(`[send-license-verified-email] deduped (recent send) for ${email}`);
        results.push({ email, success: true, deduped: true, jobId: recent[0].id });
        continue;
      }

      const ctaUrl = await resolveCtaForRecipient(email);
      const html = buildLicenseVerifiedEmailHtml({ ctaUrl, agentName: body.agentName, footerAgent });
      const { data: inserted, error } = await admin
        .from("email_jobs")
        .insert({
          stream: "transactional",
          idempotency_key: idempotencyKey,
          payload: {
            provider: "resend",
            template: "license-verified",
            to: email,
            subject,
            html,
            reply_to: replyTo,
            idempotency_key: idempotencyKey,
          },
        })
        .select("id")
        .maybeSingle();

      if (error) {
        // Race: another insert won the unique index — treat as durable success.
        if (error.code === "23505") {
          const { data: raced } = await admin
            .from("email_jobs")
            .select("id")
            .eq("idempotency_key", idempotencyKey)
            .maybeSingle();
          if (raced?.id) {
            results.push({ email, success: true, deduped: true, jobId: raced.id });
            continue;
          }
        }
        console.error(`[send-license-verified-email] enqueue failed for ${email}:`, error);
        results.push({ email, success: false, error: error.message });
      } else if (!inserted?.id) {
        results.push({ email, success: false, error: "Enqueue returned no job id" });
      } else {
        results.push({ email, success: true, jobId: inserted.id });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const blockedResults = results.filter((r) => r.error === "previously_deleted");

    if (successCount === 0 && blockedResults.length > 0) {
      return new Response(
        JSON.stringify({
          success: false,
          code: "previously_deleted",
          // deno-lint-ignore no-explicit-any
          match: (blockedResults[0] as any).match ?? null,
          successCount: 0,
          results,
        }),
        { status: 409, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    if (successCount === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          successCount: 0,
          error: results[0]?.error || "Failed to enqueue license-verified email",
          results,
        }),
        { status: 422, headers: { "Content-Type": "application/json", ...corsHeaders } },
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
      console.warn("[send-license-verified-email] kick-email-queue failed:", err);
    });

    return new Response(
      JSON.stringify({ success: true, successCount, results }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (err: any) {
    console.error("[send-license-verified-email] error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message ?? "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
};

serve(handler);
