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
  mode?: "initial" | "resend";
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
      actorUserId,
      clientId,
      mode = "initial",
    } = body;

    // B6 guardrail: client email is required
    if (!invitedEmail || !invitedEmail.trim()) {
      console.error("[send-hot-sheet-invite] Missing invitedEmail — aborting");
      return new Response(JSON.stringify({ error: "invitedEmail is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // --- Resend cooldown gate (2 minutes per token) ---
    if (mode === "resend" && tokenId) {
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      const { data: recentJob } = await supabase
        .from("email_jobs")
        .select("id, created_at")
        .eq("idempotency_key", `hot_sheet_invite:${tokenId}:resend`)
        .gte("created_at", twoMinutesAgo)
        .maybeSingle();

      if (recentJob) {
        console.log("[send-hot-sheet-invite] Resend cooldown active for token:", tokenId);
        return new Response(
          JSON.stringify({ success: true, skipped: true, reason: "cooldown" }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    // --- Fetch listing teasers ---
    let teasers: ListingTeaser[] = [];
    if (hotSheetId) {
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

    // --- Idempotency key ---
    // For initial sends: one job per token ever.
    // For resends: one job per token per minute-bucket (2-min cooldown enforced above).
    const minuteBucket = mode === "resend"
      ? `resend`  // already gated by 2-min cooldown query above
      : "v1";
    const idempotencyKey = tokenId
      ? `hot_sheet_invite:${tokenId}:${minuteBucket}`
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
        return new Response(JSON.stringify({ success: true, skipped: true, reason: "idempotent" }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      throw insertError;
    }

    // --- Audit log: email_enqueued or invite_resent ---
    if (tokenId) {
      const eventType = mode === "resend" ? "invite_resent" : "email_enqueued";
      await supabase.from("invite_events").insert({
        token_id: tokenId,
        hot_sheet_id: hotSheetId || null,
        client_id: clientId || null,
        client_email: invitedEmail,
        event_type: eventType,
        email_job_id: jobRow?.id || null,
        actor_user_id: actorUserId || null,
        meta: { mode, inviterName, hotSheetName },
      });

      // If resend, also log email_enqueued as a separate entry for clarity
      if (mode === "resend" && jobRow?.id) {
        await supabase.from("invite_events").insert({
          token_id: tokenId,
          hot_sheet_id: hotSheetId || null,
          client_id: clientId || null,
          client_email: invitedEmail,
          event_type: "email_enqueued",
          email_job_id: jobRow.id,
          actor_user_id: actorUserId || null,
          meta: { mode: "resend", inviterName, hotSheetName },
        });
      }
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
