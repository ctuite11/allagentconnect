import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

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
}

interface ListingTeaser {
  photoUrl: string;
  price: string;
  cityState: string;
  bedsBaths: string;
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
    } = body;

    const inviteOnly = mode === "invite_only";

    // --- Server-side JWT authorization ---
    // For resend mode, verify the caller owns the token and it is unaccepted.
    // actorUserId from the request body is IGNORED — we derive it from the JWT.
    let verifiedActorUserId: string | null = null;

    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const authedClient = createClient(
        supabaseUrl,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );

      const { data: { user }, error: userError } = await authedClient.auth.getUser();
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

        // Must be unaccepted
        if (tokenRow.accepted_at || tokenRow.accepted_by_user_id) {
          return new Response(JSON.stringify({ error: "Token already accepted" }), {
            status: 409,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }
      }
    }

    // --- Fetch listing teasers ---
    let teasers: ListingTeaser[] = [];

    if (!inviteOnly && hotSheetId) {
      const { data: matchingListings } = await supabase
        .rpc("check_hot_sheet_matches", { p_hot_sheet_id: hotSheetId });

      const listingIds = (matchingListings || []).slice(0, 3).map((m: any) => m.listing_id);

      if (listingIds.length > 0) {
        const { data: listings } = await supabase
          .from("listings")
          .select("price, city, state, bedrooms, bathrooms, photos")
          .in("id", listingIds);

        teasers = (listings || []).slice(0, 3).map((listing: any) => ({
          photoUrl: listing?.photos?.[0]?.url || "",
          price: listing?.price ? `$${Number(listing.price).toLocaleString()}` : "Price unavailable",
          cityState: [listing?.city, listing?.state].filter(Boolean).join(", "),
          bedsBaths: [
            listing?.bedrooms ? `${listing.bedrooms} bd` : null,
            listing?.bathrooms ? `${listing.bathrooms} ba` : null,
          ].filter(Boolean).join(" • "),
        }));
      }
    }

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

    const jobPayload = {
      provider: "resend",
      template: "hot-sheet-invite",
      to: invitedEmail,
      subject: `${inviterName} shared a Hot Sheet with you`,
      variables: { inviterName, hotSheetName, hotSheetLink, teasers },
    };

    // Build insert row — include idempotency_key if we have one
    const insertRow: Record<string, unknown> = { payload: jobPayload };
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
              meta: { mode, inviterName, hotSheetName, idempotent: true },
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
        meta: { mode, inviterName, hotSheetName },
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
