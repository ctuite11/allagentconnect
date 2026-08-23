/**
 * Explicit "Send Again" for an already-sent Communications broadcast.
 *
 * Contract guarantees:
 *  - NEVER inserts a new comms_broadcasts row (no duplicate AAC post).
 *  - Reuses the ORIGINAL audience durably recorded in agent_sent_broadcasts,
 *    intersected with the currently eligible Agent Network audience so
 *    suppressed / removed agents are dropped. No new recipients are added and
 *    no Communications matching/filter rule is re-evaluated.
 *  - Outgoing email subject is exactly "Updated message".
 *  - Idempotent per (broadcast_id, resend_token) via
 *    public.begin_comms_broadcast_resend, plus a per-recipient email_jobs
 *    idempotency key scoped to the resend number.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
import { getVerifiedAgentAudienceWithStats } from "../_shared/verifiedAgentAudience.ts";
import { assertCommsEnqueueAllowed } from "../_shared/emailStreams.ts";
import {
  buildAttachmentCtaHtml,
  type NormalizedCommsAttachment,
} from "../_shared/commsBroadcastAttachments.ts";
import { commsBroadcastActionUrl } from "../_shared/commsDigest.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** The resend subject is fixed by product decision. Do not template it. */
const RESEND_SUBJECT = "Updated message";

const CATEGORY_LABEL: Record<string, string> = {
  buyer_need: "Buyer Need",
  renter_need: "Renter Need",
  sales_intel: "Sales Intel",
  general_discussion: "General Discussion",
};

const isValidEmail = (email: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return json({ success: false, error: "Unauthorized" }, 401);

    const admin = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    const user = userErr ? null : userData?.user ?? null;
    if (!user) return json({ success: false, error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => null) as
      | {
          broadcast_id?: string;
          resend_token?: string;
          subject?: string;
          message?: string;
          attachments?: unknown;
        }
      | null;

    const broadcastId = typeof body?.broadcast_id === "string" ? body.broadcast_id.trim() : "";
    const resendToken = typeof body?.resend_token === "string" ? body.resend_token.trim() : "";
    if (!broadcastId) return json({ success: false, error: "broadcast_id is required" }, 400);
    if (!resendToken) return json({ success: false, error: "resend_token is required" }, 400);

    // Caller-scoped client: ownership and edit rules are enforced by the
    // existing RPCs / RLS, never by this function's service role.
    const asUser = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 1. Optionally persist the current edit first (same RPC as Save changes).
    if (typeof body?.subject === "string" || typeof body?.message === "string") {
      const subject = (body.subject ?? "").trim();
      const message = (body.message ?? "").trim();
      if (!subject) return json({ success: false, error: "Please enter a subject." }, 400);
      if (!message) return json({ success: false, error: "Please enter a message." }, 400);
      const { error: editErr } = await asUser.rpc("update_comms_broadcast", {
        _broadcast_id: broadcastId,
        _subject: subject,
        _message: message,
        _attachments: (body.attachments ?? []) as unknown,
      });
      if (editErr) return json({ success: false, error: editErr.message }, 400);
    }

    // 2. Idempotent resend reservation (owner-only, enforced in the RPC).
    const { data: reservation, error: reserveErr } = await asUser.rpc(
      "begin_comms_broadcast_resend",
      { _broadcast_id: broadcastId, _resend_token: resendToken },
    );
    if (reserveErr) return json({ success: false, error: reserveErr.message }, 403);

    const res = reservation as {
      resend_id: string;
      resend_number: number;
      already_started: boolean;
      status: string;
      recipient_count: number;
    };

    if (res.already_started) {
      return json({
        success: true,
        broadcast_id: broadcastId,
        resend_id: res.resend_id,
        resend_number: res.resend_number,
        duplicate_suppressed: true,
        status: res.status,
        recipient_count: res.recipient_count,
        subject_used: RESEND_SUBJECT,
      });
    }

    const finalize = async (
      status: "completed" | "skipped_paused" | "failed",
      recipientCount: number,
    ) => {
      await admin
        .from("comms_broadcast_resends")
        .update({ status, recipient_count: recipientCount })
        .eq("id", res.resend_id);
    };

    // 3. Load the (already updated) broadcast + its current attachments.
    const { data: broadcast, error: bErr } = await admin
      .from("comms_broadcasts")
      .select("id, sender_id, category, subject, message, criteria")
      .eq("id", broadcastId)
      .single();
    if (bErr || !broadcast) {
      await finalize("failed", 0);
      return json({ success: false, error: "Communication not found" }, 404);
    }

    const { data: attachmentRows } = await admin
      .from("comms_broadcast_attachments")
      .select("path, kind, mime_type, file_name, size_bytes, sort_order")
      .eq("broadcast_id", broadcastId)
      .order("sort_order", { ascending: true });
    const attachments = (attachmentRows ?? []) as NormalizedCommsAttachment[];

    // 4. Pause gate — nothing downstream may be written while paused.
    const pause = assertCommsEnqueueAllowed();
    if (pause.paused) {
      await finalize("skipped_paused", 0);
      return json({
        success: true,
        broadcast_id: broadcastId,
        resend_id: res.resend_id,
        resend_number: res.resend_number,
        email_fanout_skipped: true,
        paused: true,
        reason: pause.reason,
        switch: pause.switch,
        recipient_count: 0,
        subject_used: RESEND_SUBJECT,
      });
    }

    // 5. Original audience, durably recorded at first send.
    const { data: originalRows } = await admin
      .from("agent_sent_broadcasts")
      .select("agent_id, reason")
      .eq("broadcast_id", broadcastId);
    const originalIds = new Set((originalRows ?? []).map((r: any) => r.agent_id as string));
    if (originalIds.size === 0) {
      await finalize("completed", 0);
      return json({
        success: true,
        broadcast_id: broadcastId,
        resend_id: res.resend_id,
        resend_number: res.resend_number,
        recipient_count: 0,
        original_recipient_count: 0,
        dropped_ineligible: 0,
        subject_used: RESEND_SUBJECT,
      });
    }

    // Intersect with the currently eligible audience: never widens the set.
    const { audience } = await getVerifiedAgentAudienceWithStats(admin);
    const recipients = audience.filter(
      (a) => originalIds.has(a.agent_id) && a.agent_id !== broadcast.sender_id && isValidEmail(a.email ?? ""),
    );

    // 6. Compose. Subject line is fixed; body carries the updated content.
    const { data: senderProfile } = await admin
      .from("agent_profiles")
      .select("first_name, last_name, email, company")
      .eq("id", broadcast.sender_id)
      .single();
    const senderName = senderProfile
      ? `${senderProfile.first_name} ${senderProfile.last_name}`
      : "An Agent";
    const senderCompany = senderProfile?.company || "";
    const senderEmail = senderProfile?.email || "";
    const validReplyTo = senderEmail && isValidEmail(senderEmail) ? senderEmail : undefined;
    const categoryLabel = CATEGORY_LABEL[broadcast.category as string] ?? "Communication";

    const itemHtml = `
            <p style="margin:0 0 12px;font-size:14px;color:#334155;"><strong>Updated message</strong> — this Communication was updated by the sender.</p>
            <h2 style="margin:0 0 8px;font-size:16px;color:#0f172a;">${broadcast.subject}</h2>
            <p style="margin:0 0 8px;font-size:14px;color:#334155;"><strong>From:</strong> ${senderName}${senderCompany ? ` (${senderCompany})` : ""}</p>
            <p style="margin:0 0 12px;font-size:14px;color:#334155;"><strong>Category:</strong> ${categoryLabel}</p>
            <div style="background:#ffffff;border:1px solid #e5e7eb;padding:16px;border-radius:8px;">
              <p style="white-space: pre-wrap;margin:0;font-size:14px;color:#334155;">${broadcast.message}</p>
            </div>${buildAttachmentCtaHtml(attachments, senderName, commsBroadcastActionUrl(broadcastId))}`;

    const emailJobs = recipients.map((r) => ({
      idempotency_key: `client-need-broadcast-resend:${broadcastId}:${res.resend_number}:${r.agent_id}`,
      payload: {
        provider: "resend",
        template: "client-need-broadcast",
        to: r.email,
        subject: RESEND_SUBJECT,
        reply_to: validReplyTo,
        // Opt-in broadcast stream -> footer opt-out links + List-Unsubscribe.
        category: "comms_broadcast",
        metadata: {
          audience: "agent",
          reason: "resend",
          broadcast_id: broadcastId,
          resend_number: res.resend_number,
          category: broadcast.category,
        },
        variables: {
          agentName: r.first_name,
          senderName,
          senderCompany,
          category: categoryLabel,
          subject: RESEND_SUBJECT,
          message: broadcast.message,
          criteriaText: "",
          contentHtml: itemHtml,
        },
      },
    }));

    if (emailJobs.length > 0) {
      const { error: insertError } = await admin.from("email_jobs").insert(emailJobs);
      if (insertError) {
        console.error("[resend-comms-broadcast] enqueue failed:", insertError);
        await finalize("failed", 0);
        return json({ success: false, error: "Failed to queue emails" }, 500);
      }
    }

    await finalize("completed", recipients.length);

    console.log(
      `[resend-comms-broadcast] broadcast=${broadcastId} resend=${res.resend_number} original=${originalIds.size} enqueued=${recipients.length}`,
    );

    return json({
      success: true,
      broadcast_id: broadcastId,
      resend_id: res.resend_id,
      resend_number: res.resend_number,
      recipient_count: recipients.length,
      original_recipient_count: originalIds.size,
      dropped_ineligible: originalIds.size - recipients.length,
      subject_used: RESEND_SUBJECT,
    });
  } catch (error: any) {
    console.error("[resend-comms-broadcast] Error:", error);
    return json({ success: false, error: error?.message ?? "Unexpected error" }, 500);
  }
});
