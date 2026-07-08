import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { renderHotSheetMatchListingEmailCard } from "../_shared/listingEmailCard.ts";
import { resolveEmailBaseUrl } from "../_shared/aacPublicUrl.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Optional near-realtime mode: when invoked from a listing trigger with
    // { trigger: "listing", listing_id }, we still process all active hot
    // sheets — the canonical matcher dedupes per (hot_sheet_id, listing_id,
    // status_at_send) so this is safe to call frequently.
    let triggerListingId: string | null = null;
    try {
      if (req.headers.get("content-type")?.includes("application/json")) {
        const body = await req.json().catch(() => null);
        triggerListingId = body?.listing_id ?? null;
        if (triggerListingId) {
          console.log(`[send-new-match-notification] near-realtime trigger for listing ${triggerListingId}`);
        }
      }
    } catch {
      // ignore body parse errors — cron invocations have no body
    }

    // Fetch active hot sheets with owner details
    const { data: hotSheets, error: fetchError } = await supabase
      .from("hot_sheets")
      .select("id, user_id, name")
      .eq("is_active", true);

    if (fetchError) throw fetchError;

    if (!hotSheets || hotSheets.length === 0) {
      return new Response(
        JSON.stringify({ message: "No hot sheets to process" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[send-new-match-notification] Processing ${hotSheets.length} hot sheets`);

    let totalMatches = 0;
    let jobsQueued = 0;

    for (const hotSheet of hotSheets) {
      // Check for new matches (now uses hot_sheet_sent_listings for dedup)
      const { data: matchingListings, error: matchError } = await supabase
        .rpc("check_hot_sheet_matches", { p_hot_sheet_id: hotSheet.id });

      if (matchError || !matchingListings?.length) continue;

      totalMatches += matchingListings.length;

      // Fetch full listing details
      const { data: listings } = await supabase
        .from("listings")
        .select("*")
        .in("id", matchingListings.map((m: any) => m.listing_id));

      if (!listings?.length) continue;

      // Pull assigned recipients for this hot sheet
      const { data: hotSheetClients, error: clientsError } = await supabase
        .from("hot_sheet_clients")
        .select("client_id, clients(email, first_name)")
        .eq("hot_sheet_id", hotSheet.id);

      if (clientsError || !hotSheetClients?.length) continue;

      // Pull accepted invite tokens for this hot sheet
      const { data: acceptedTokens, error: tokenError } = await supabase
        .from("share_tokens")
        .select("accepted_at, payload")
        .eq("agent_id", hotSheet.user_id)
        .eq("payload->>type", "client_hotsheet_invite")
        .eq("payload->>hot_sheet_id", hotSheet.id)
        .not("accepted_at", "is", null);

      if (tokenError || !acceptedTokens?.length) {
        console.log(`[send-new-match-notification] Skipping ${hotSheet.id}: no accepted invite tokens`);
        continue;
      }

      type AcceptanceMeta = { acceptedAt: string; suppressInitial: boolean };

      const acceptedByClientId = new Map<string, AcceptanceMeta>();
      const acceptedByEmail = new Map<string, AcceptanceMeta>();

      for (const token of acceptedTokens as any[]) {
        const acceptedAt = token?.accepted_at ? String(token.accepted_at) : null;
        if (!acceptedAt) continue;

        const payload = token?.payload ?? {};
        const suppressInitial = Boolean(payload?.suppress_initial_matches);

        const cid = payload?.client_id ? String(payload.client_id) : null;
        const email = payload?.client_email ? String(payload.client_email).toLowerCase() : null;

        if (cid) {
          const prev = acceptedByClientId.get(cid);
          if (!prev || new Date(acceptedAt).getTime() > new Date(prev.acceptedAt).getTime()) {
            acceptedByClientId.set(cid, { acceptedAt, suppressInitial });
          }
        }

        if (email) {
          const prev = acceptedByEmail.get(email);
          if (!prev || new Date(acceptedAt).getTime() > new Date(prev.acceptedAt).getTime()) {
            acceptedByEmail.set(email, { acceptedAt, suppressInitial });
          }
        }
      }

      const acceptedRecipients = hotSheetClients
        .map((row: any) => {
          const client = Array.isArray(row.clients) ? row.clients[0] : row.clients;
          const clientId = row.client_id ? String(row.client_id) : null;
          const email = client?.email ? String(client.email).toLowerCase() : null;

          const meta =
            (clientId && acceptedByClientId.get(clientId)) ||
            (email && acceptedByEmail.get(email)) ||
            null;

          return {
            clientId,
            email,
            firstName: client?.first_name || "",
            acceptedAt: meta?.acceptedAt || null,
            suppressInitial: meta?.suppressInitial || false,
          };
        })
        .filter((recipient: any) => {
          if (!recipient.email) return false;
          return Boolean(recipient.acceptedAt);
        });

      if (!acceptedRecipients.length) {
        console.log(`[send-new-match-notification] Skipping ${hotSheet.id}: recipients not accepted yet`);
        continue;
      }

      const appBaseUrl = resolveEmailBaseUrl(
        Deno.env.get("EMAIL_BASE_URL") ||
          Deno.env.get("APP_BASE_URL") ||
          Deno.env.get("SITE_URL"),
      );

      // Build listings HTML
      const listingsHtml = listings
        .map((listing: any) => renderHotSheetMatchListingEmailCard(listing, { baseUrl: appBaseUrl }))
        .join("");

      let queuedForHotSheet = 0;

      for (const recipient of acceptedRecipients) {
        // Suppress matches that predate acceptance for invite_only tokens
        let recipientListings = listings;
        if (recipient.suppressInitial && recipient.acceptedAt) {
          const cutoff = new Date(recipient.acceptedAt).getTime();
          recipientListings = listings.filter((l: any) => {
            const ts = l.created_at || l.updated_at;
            if (!ts) return false;
            return new Date(ts).getTime() > cutoff;
          });
        }

        if (!recipientListings.length) {
          console.log(
            `[send-new-match-notification] Skipping ${hotSheet.id} for ${recipient.email}: suppressInitial filtered all matches`
          );
          continue;
        }

        const recipientListingsHtml = recipientListings
          .map((listing: any) => renderHotSheetMatchListingEmailCard(listing, { baseUrl: appBaseUrl }))
          .join("");

        const { error: insertError } = await supabase.from("email_jobs").insert({
          payload: {
            provider: "resend",
            template: "new-match-notification",
            to: recipient.email,
            subject: `New matches in your Hot Sheet: ${hotSheet.name}`,
            variables: {
              userName: recipient.firstName || "there",
              hotSheetName: hotSheet.name,
              matchCount: recipientListings.length,
              listingsHtml: recipientListingsHtml,
              hotSheetLink: `${appBaseUrl}/client/hot-sheets/${hotSheet.id}`,
            },
          },
        });

        if (!insertError) {
          jobsQueued++;
          queuedForHotSheet++;
        }
      }

      // ─── Email subscribers (no-account "Add a Friend") ───────────────
      const { data: subscribers } = await supabase
        .from("hot_sheet_subscribers" as any)
        .select("id, email, first_name, unsubscribe_token, preview_token")
        .eq("hot_sheet_id", hotSheet.id)
        .eq("status", "active");

      if (subscribers?.length) {
        for (const sub of subscribers) {
          const dedupeKey = `hss:${sub.id}:hs:${hotSheet.id}:listings:${matchingListings.map((m: any) => m.listing_id).sort().join(",")}`;

          const { error: subInsertError } = await supabase.from("email_jobs").insert({
            idempotency_key: dedupeKey,
            payload: {
              provider: "resend",
              template: "hot-sheet-subscriber-update",
              to: sub.email,
              subject: `New matches in ${hotSheet.name}`,
              variables: {
                userName: sub.first_name || "there",
                hotSheetName: hotSheet.name,
                matchCount: listings.length,
                listingsHtml,
                previewLink: `${appBaseUrl}/hotsheet-preview?token=${(sub as any).preview_token}`,
                unsubscribeLink: `${appBaseUrl}/unsubscribe-hotsheet?token=${sub.unsubscribe_token}`,
              },
            },
          });

          if (!subInsertError) {
            jobsQueued++;
            queuedForHotSheet++;
          }
        }
      }

      if (queuedForHotSheet > 0) {
        
        // Record in hot_sheet_sent_listings (canonical dedup source)
        // Get listing statuses for status_at_send
        const listingIds = matchingListings.map((m: any) => m.listing_id);
        const { data: listingStatuses } = await supabase
          .from("listings")
          .select("id, status")
          .in("id", listingIds);

        const statusMap = new Map((listingStatuses || []).map((l: any) => [l.id, l.status]));

        const sentRecords = matchingListings.map((match: any) => ({
          hot_sheet_id: hotSheet.id,
          listing_id: match.listing_id,
          status_at_send: statusMap.get(match.listing_id) || 'active',
        }));

        await supabase
          .from("hot_sheet_sent_listings")
          .upsert(sentRecords, { onConflict: "hot_sheet_id,listing_id,status_at_send" });

        // Also record in hot_sheet_notifications (audit/logging)
        const notificationRecords = matchingListings.map((match: any) => ({
          hot_sheet_id: hotSheet.id,
          listing_id: match.listing_id,
          user_id: hotSheet.user_id,
          notification_sent: true,
          notification_sent_at: new Date().toISOString(),
        }));

        await supabase.from("hot_sheet_notifications").insert(notificationRecords);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        hotSheetsProcessed: hotSheets.length,
        totalMatches,
        jobsQueued,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[send-new-match-notification] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
