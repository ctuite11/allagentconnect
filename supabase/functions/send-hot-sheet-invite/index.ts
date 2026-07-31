import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { buildHotSheetInviteEmailSubject } from "../_shared/hotSheetInviteEmail.ts";
import { formatPersonDisplayName } from "../_shared/personDisplayName.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface HotSheetInviteRequest {
  /** Client email address */
  invitedEmail: string;
  inviterName: string;
  hotSheetName: string;
  hotSheetLink: string;
  hotSheetId?: string;
  /** The UUID of the share_token row — used for idempotency + audit */
  tokenId?: string;
  /** actor agent user_id — used for audit logging */
  actorUserId?: string;
  clientId?: string;
  /** 'initial' | 'resend' — controls audit event type */
  mode?: "initial" | "resend" | "invite_only";
  /** Optional recipient first/full name for personalization */
  recipientName?: string;
  /** Optional inviter contact info — looked up server-side if omitted */
  inviterEmail?: string;
  inviterPhone?: string;
  inviterBrokerage?: string;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: HotSheetInviteRequest = await req.json();
    const {
      invitedEmail,
      inviterName,
      hotSheetName,
      hotSheetLink,
      hotSheetId,
      tokenId,
      clientId,
      mode = "invite_only",
      recipientName,
    } = body;
    let inviterEmail = (body.inviterEmail || "").trim();
    let inviterPhone = (body.inviterPhone || "").trim();
    let inviterBrokerage = (body.inviterBrokerage || "").trim();

    const inviteOnly = mode === "invite_only";

    // --- Server-side JWT authorization ---
    // For resend mode, verify the caller owns the token and it is unaccepted.
    // actorUserId from the request body is IGNORED — we derive it from the JWT.
    let verifiedActorUserId: string | null = null;

    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const jwt = authHeader.replace("Bearer ", "").trim();
      const authedClient = createClient(
        supabaseUrl,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );

      const { data: { user }, error: userError } = await authedClient.auth.getUser(jwt);
      if (!userError && user?.id) {
        verifiedActorUserId = user.id;
      }
    }

    // For resend: caller MUST be authenticated and own the token
    if (mode === "resend") {
      if (!verifiedActorUserId) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      if (tokenId) {
        const { data: tokenRow, error: tokenErr } = await supabase
          .from("share_tokens")
          .select("agent_id, accepted_at, accepted_by_user_id")
          .eq("id", tokenId)
          .maybeSingle();

        if (tokenErr || !tokenRow) {
          return new Response(JSON.stringify({ error: "Token not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }

        // Must own the token
        if (tokenRow.agent_id !== verifiedActorUserId) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }

        // Invite email is not applicable once accepted; treat as success so UI batch sends don’t hard-fail.
        if (tokenRow.accepted_at || tokenRow.accepted_by_user_id) {
          console.log("[send-hot-sheet-invite] Skipping resend — token already accepted", { tokenId });
          return new Response(
            JSON.stringify({ success: true, skipped: true, reason: "already_accepted" }),
            { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
          );
        }
      }
    }

    // Resolve actor from JWT, or from share_tokens when enqueueing initial sends.
    let actorUserIdForProfile = verifiedActorUserId;
    if (!actorUserIdForProfile && tokenId) {
      const { data: tokenActorRow } = await supabase
        .from("share_tokens")
        .select("agent_id")
        .eq("id", tokenId)
        .maybeSingle();
      actorUserIdForProfile = (tokenActorRow?.agent_id as string | null) ?? null;
    }

    // --- Lookup inviter name + contact info if not provided by caller ---
    // Single best-effort lookup against agent_profiles. Keeps the email aligned
    // with listing-share (sender shown in body) and fixes lowercase DB names.
    let resolvedInviterName = inviterName;
    if (actorUserIdForProfile) {
      const { data: agentProfile } = await supabase
        .from("agent_profiles")
        .select("first_name, last_name, email, phone, cell_phone, company")
        .eq("id", actorUserIdForProfile)
        .maybeSingle();

      if (agentProfile) {
        const profileName = [agentProfile.first_name, agentProfile.last_name]
          .filter(Boolean)
          .join(" ")
          .trim();
        if (profileName) resolvedInviterName = profileName;

        if (!inviterEmail) inviterEmail = (agentProfile.email as string | null) || "";
        if (!inviterPhone) {
          inviterPhone =
            (agentProfile.cell_phone as string | null)?.trim() ||
            (agentProfile.phone as string | null)?.trim() ||
            "";
        }
        if (!inviterBrokerage) inviterBrokerage = (agentProfile.company as string | null) || "";
      }
    }

    const displayInviterName = formatPersonDisplayName(resolvedInviterName);

    // --- B6 guardrail: client email is required ---
    if (!invitedEmail || !invitedEmail.trim()) {
      console.error("[send-hot-sheet-invite] Missing invitedEmail — aborting");
      return new Response(JSON.stringify({ error: "invitedEmail is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // --- Idempotency key ---
    // Initial sends: one job per token, ever.
    // Resends: one job per token per 2-minute time bucket.
    //   Using floor(epoch / 120) gives a new bucket every 120 seconds,
    //   so a resend can succeed once per 2-minute window without being
    //   permanently blocked by the "resend" static key used previously.
    const twoMinBucket = Math.floor(Date.now() / 1000 / 120);
    const idempotencyKey = tokenId
      ? mode === "resend"
        ? `hot_sheet_invite:${tokenId}:resend:${twoMinBucket}`
        : `hot_sheet_invite:${tokenId}:v1`
      : null; // no token = no idempotency (legacy call)

    console.log("[send-hot-sheet-invite] Enqueuing job for:", invitedEmail, "mode:", mode);

    const subject = inviteOnly
      ? `${displayInviterName} invited you to All Agent Connect`
      : buildHotSheetInviteEmailSubject(displayInviterName);

    const preheader = inviteOnly
      ? `Join ${displayInviterName} on AAC to see listings curated for you.`
      : subject;

    const jobPayload: Record<string, unknown> = {
      provider: "resend",
      template: "hot-sheet-invite",
      to: invitedEmail,
      subject,
      variables: {
        inviterName: displayInviterName,
        inviterEmail,
        inviterPhone,
        inviterBrokerage,
        recipientName: recipientName || "",
        hotSheetName,
        hotSheetLink,
        inviteOnly,
        preheader,
      },
    };

    if (inviterEmail && isValidEmail(inviterEmail)) {
      jobPayload.reply_to = inviterEmail;
    }

    // Build insert row — include idempotency_key if we have one
    const insertRow: Record<string, unknown> = { stream: "hot_sheet", payload: jobPayload };
    if (idempotencyKey) insertRow.idempotency_key = idempotencyKey;

    const { data: jobRow, error: insertError } = await supabase
      .from("email_jobs")
      .insert(insertRow)
      .select("id")
      .maybeSingle();

    if (insertError) {
      // Unique violation = duplicate — treat as success (idempotent)
      if (insertError.code === "23505") {
        console.log("[send-hot-sheet-invite] Duplicate job suppressed (idempotency):", idempotencyKey);

        // Ensure invite_events coverage even on idempotent skip
        if (tokenId && idempotencyKey) {
          const { data: existingJob, error: existingErr } = await supabase
            .from("email_jobs")
            .select("id")
            .eq("idempotency_key", idempotencyKey)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!existingErr && existingJob?.id) {
            const eventType = mode === "resend" ? "invite_resent" : "email_enqueued";
            await supabase.from("invite_events").insert({
              token_id: tokenId,
              hot_sheet_id: hotSheetId || null,
              client_id: clientId || null,
              client_email: invitedEmail,
              event_type: eventType,
              email_job_id: existingJob.id,
              actor_user_id: verifiedActorUserId,
              meta: { mode, inviterName: displayInviterName, hotSheetName, idempotent: true },
            });
          } else {
            console.error("[send-hot-sheet-invite] idempotent but failed to fetch job by key", existingErr);
          }
        }

        return new Response(JSON.stringify({ success: true, skipped: true, reason: "idempotent" }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      throw insertError;
    }

    // --- Audit log: email_enqueued or invite_resent ---
    // Only log if the job was actually created (jobRow.id proves the insert succeeded).
    // actor_user_id is always taken from the verified JWT, never from the request body.
    if (tokenId && jobRow?.id) {
      const eventType = mode === "resend" ? "invite_resent" : "email_enqueued";
      await supabase.from("invite_events").insert({
        token_id: tokenId,
        hot_sheet_id: hotSheetId || null,
        client_id: clientId || null,
        client_email: invitedEmail,
        event_type: eventType,
        email_job_id: jobRow.id,
        actor_user_id: verifiedActorUserId,
        meta: { mode, inviterName: displayInviterName, hotSheetName },
      });

      // Resend only logs invite_resent (no redundant email_enqueued)
    }

    return new Response(JSON.stringify({ success: true, jobId: jobRow?.id }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("[send-hot-sheet-invite] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
