import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { renderHotSheetMatchListingEmailCard } from "../_shared/listingEmailCard.ts";
import { resolveEmailBaseUrl } from "../_shared/aacPublicUrl.ts";
import { getHotSheetStatusCopy, normalizeStatusKey, type HotSheetStatusKey } from "../_shared/hotSheetStatusCopy.ts";

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
      .select("id, user_id, name, notify_agent_email, notify_client_email, notification_schedule")
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
      const listingIds = matchingListings.map((m: any) => m.listing_id);
      const { data: listings } = await supabase
        .from("listings")
        .select("*")
        .in("id", listingIds);

      if (!listings?.length) continue;

      // Deterministic ordering
      listings.sort((a: any, b: any) => String(a.id).localeCompare(String(b.id)));

      // Classify each listing as new-match vs status-change based on ALL prior sends
      const { data: priorSends } = await supabase
        .from("hot_sheet_sent_listings")
        .select("listing_id, status_at_send")
        .eq("hot_sheet_id", hotSheet.id)
        .in("listing_id", listingIds);

      const priorStatusesByListing = new Map<string, Set<string>>();
      for (const row of priorSends || []) {
        const key = String((row as any).listing_id);
        const set = priorStatusesByListing.get(key) || new Set<string>();
        set.add(String((row as any).status_at_send || ""));
        priorStatusesByListing.set(key, set);
      }

      const newMatchListings: any[] = [];
      const statusChangeListings: any[] = [];
      for (const l of listings) {
        const prior = priorStatusesByListing.get(String(l.id));
        const currentStatus = String(l.status || "active");
        if (!prior || prior.size === 0) {
          newMatchListings.push(l);
        } else if (prior.has(currentStatus)) {
          // Already sent at this exact status — skip
          continue;
        } else {
          statusChangeListings.push(l);
        }
      }

      if (newMatchListings.length === 0 && statusChangeListings.length === 0) {
        continue;
      }

      const appBaseUrl = resolveEmailBaseUrl(
        Deno.env.get("EMAIL_BASE_URL") ||
          Deno.env.get("APP_BASE_URL") ||
          Deno.env.get("SITE_URL"),
      );

      const renderCards = (items: any[]) =>
        items
          .map((listing: any) => renderHotSheetMatchListingEmailCard(listing, { baseUrl: appBaseUrl }))
          .join("");

      const newMatchListingsHtml = renderCards(newMatchListings);

      // Group status-change listings by normalized current status so each
      // transition type sends its own tailored email.
      const statusGroups = new Map<HotSheetStatusKey, any[]>();
      for (const l of statusChangeListings) {
        const key = normalizeStatusKey(l.status);
        const bucket = statusGroups.get(key) || [];
        bucket.push(l);
        statusGroups.set(key, bucket);
      }

      let queuedForHotSheet = 0;
      // Track which (listing_id, status) pairs actually enqueued successfully so
      // we only record dedup rows for sends that made it into email_jobs.
      const successfullySent = new Set<string>();
      const markSent = (items: any[]) => {
        for (const l of items) successfullySent.add(`${l.id}::${String(l.status || "active")}`);
      };

      // ─── Owning agent delivery (canonical agent listing-alert path) ───
      // Agents receive property emails ONLY through a hot sheet they own.
      // No hot sheet → no email. Gated on the hot sheet's own settings.
      if (
        (hotSheet as any).notify_agent_email === true &&
        String((hotSheet as any).notification_schedule || "immediately") === "immediately"
      ) {
        const { data: ownerProfile } = await supabase
          .from("agent_profiles")
          .select("id, email, first_name")
          .eq("id", hotSheet.user_id)
          .maybeSingle();

        const ownerEmail = ownerProfile?.email ? String(ownerProfile.email) : null;

        if (ownerEmail) {
          // Never alert an agent about their own listing.
          const notOwnListing = (l: any) => String(l.agent_id || "") !== String(hotSheet.user_id);
          // Freshness cutoff: agents get alerts for recent market activity only.
          // Prevents this new path from dumping a historical backlog of matches
          // on its first run.
          const AGENT_FRESHNESS_MS = 72 * 60 * 60 * 1000;
          const cutoff = Date.now() - AGENT_FRESHNESS_MS;
          const isFresh = (l: any) => {
            const ts = l.updated_at || l.created_at;
            if (!ts) return false;
            return new Date(ts).getTime() >= cutoff;
          };
          const agentEligible = (l: any) => notOwnListing(l) && isFresh(l);
          const agentNew = newMatchListings.filter(agentEligible);
          const agentName = ownerProfile?.first_name || "there";

          if (agentNew.length > 0) {
            const ids = agentNew.map((l: any) => String(l.id)).sort().join(",");
            const { error } = await supabase.from("email_jobs").insert({
              idempotency_key: `hs-agent:${hotSheet.id}:new:${ids}`,
              payload: {
                provider: "resend",
                template: "agent-new-listing-alert",
                to: ownerEmail,
                subject: `New matches in your Hot Sheet: ${hotSheet.name}`,
                variables: {
                  userName: agentName,
                  hotSheetName: hotSheet.name,
                  matchCount: agentNew.length,
                  listingsHtml: renderCards(agentNew),
                  hotSheetLink: `${appBaseUrl}/hot-sheets/${hotSheet.id}/review`,
                },
              },
            });
            if (!error) {
              jobsQueued++;
              queuedForHotSheet++;
              markSent(agentNew);
            } else {
              console.error(`[send-new-match-notification] agent new-match enqueue failed for ${hotSheet.id}:`, error);
            }
          }

          for (const [statusKey, groupListings] of statusGroups) {
            const agentGroup = groupListings.filter(agentEligible);
            if (agentGroup.length === 0) continue;
            const copy = getHotSheetStatusCopy(statusKey);
            const ids = agentGroup.map((l: any) => String(l.id)).sort().join(",");
            const { error } = await supabase.from("email_jobs").insert({
              idempotency_key: `hs-agent:${hotSheet.id}:status:${statusKey}:${ids}`,
              payload: {
                provider: "resend",
                template: "agent-new-listing-alert",
                to: ownerEmail,
                subject: copy.subject(hotSheet.name),
                variables: {
                  userName: agentName,
                  hotSheetName: hotSheet.name,
                  statusKey,
                  matchCount: agentGroup.length,
                  listingsHtml: renderCards(agentGroup),
                  hotSheetLink: `${appBaseUrl}/hot-sheets/${hotSheet.id}/review`,
                },
              },
            });
            if (!error) {
              jobsQueued++;
              queuedForHotSheet++;
              markSent(agentGroup);
            } else {
              console.error(`[send-new-match-notification] agent status-change (${statusKey}) enqueue failed:`, error);
            }
          }
        }
      }

      // ─── Assigned client recipients (acceptance-gated) ────────────────
      const acceptedRecipients = await (async () => {
        const { data: hotSheetClients, error: clientsError } = await supabase
          .from("hot_sheet_clients")
          .select("client_id, clients(email, first_name)")
          .eq("hot_sheet_id", hotSheet.id);

        if (clientsError || !hotSheetClients?.length) return [] as any[];

        const { data: acceptedTokens, error: tokenError } = await supabase
          .from("share_tokens")
          .select("accepted_at, payload")
          .eq("agent_id", hotSheet.user_id)
          .eq("payload->>type", "client_hotsheet_invite")
          .eq("payload->>hot_sheet_id", hotSheet.id)
          .not("accepted_at", "is", null);

        if (tokenError || !acceptedTokens?.length) {
          console.log(`[send-new-match-notification] No accepted invite tokens for ${hotSheet.id}`);
          return [] as any[];
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

        return hotSheetClients
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
          .filter((recipient: any) => Boolean(recipient.email) && Boolean(recipient.acceptedAt));
      })();

      for (const recipient of acceptedRecipients) {
        // suppressInitial (invite_only) filters out anything that predates acceptance
        const filterInitial = (items: any[]) => {
          if (!(recipient.suppressInitial && recipient.acceptedAt)) return items;
          const cutoff = new Date(recipient.acceptedAt).getTime();
          return items.filter((l: any) => {
            const ts = l.created_at || l.updated_at;
            if (!ts) return false;
            return new Date(ts).getTime() > cutoff;
          });
        };

        const recipientNew = filterInitial(newMatchListings);

        if (recipientNew.length > 0) {
          const html = recipientNew === newMatchListings ? newMatchListingsHtml : renderCards(recipientNew);
          const { error: insertError } = await supabase.from("email_jobs").insert({
            payload: {
              provider: "resend",
              template: "new-match-notification",
              to: recipient.email,
              subject: `New matches in your Hot Sheet: ${hotSheet.name}`,
              variables: {
                userName: recipient.firstName || "there",
                hotSheetName: hotSheet.name,
                matchCount: recipientNew.length,
                listingsHtml: html,
                hotSheetLink: `${appBaseUrl}/client/hot-sheets/${hotSheet.id}`,
              },
            },
          });
          if (!insertError) {
            jobsQueued++;
            queuedForHotSheet++;
            markSent(recipientNew);
          } else {
            console.error(`[send-new-match-notification] enqueue new-match failed for ${recipient.email}:`, insertError);
          }
        }

        // One email per normalized status group per recipient.
        for (const [statusKey, groupListings] of statusGroups) {
          const recipientGroup = filterInitial(groupListings);
          if (recipientGroup.length === 0) continue;

          const copy = getHotSheetStatusCopy(statusKey);
          const sortedIds = recipientGroup
            .map((l: any) => String(l.id))
            .sort()
            .join(",");
          const dedupeKey = `hs:${(recipient.clientId || recipient.email)}:hs:${hotSheet.id}:status:${statusKey}:${sortedIds}`;
          const html = renderCards(recipientGroup);
          const { error: insertError } = await supabase.from("email_jobs").insert({
            idempotency_key: dedupeKey,
            payload: {
              provider: "resend",
              template: "hot-sheet-status-change",
              to: recipient.email,
              subject: copy.subject(hotSheet.name),
              variables: {
                userName: recipient.firstName || "there",
                hotSheetName: hotSheet.name,
                statusKey,
                matchCount: recipientGroup.length,
                listingsHtml: html,
                hotSheetLink: `${appBaseUrl}/client/hot-sheets/${hotSheet.id}`,
              },
            },
          });
          if (!insertError) {
            jobsQueued++;
            queuedForHotSheet++;
            markSent(recipientGroup);
          } else {
            console.error(`[send-new-match-notification] enqueue status-change (${statusKey}) failed for ${recipient.email}:`, insertError);
          }
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
          const previewLink = `${appBaseUrl}/hotsheet-preview?token=${(sub as any).preview_token}`;
          const unsubscribeLink = `${appBaseUrl}/unsubscribe-hotsheet?token=${sub.unsubscribe_token}`;

          if (newMatchListings.length > 0) {
            const ids = newMatchListings.map((l: any) => l.id).sort().join(",");
            const dedupeKey = `hss:${sub.id}:hs:${hotSheet.id}:new:${ids}`;
            const { error } = await supabase.from("email_jobs").insert({
              idempotency_key: dedupeKey,
              payload: {
                provider: "resend",
                template: "hot-sheet-subscriber-update",
                to: sub.email,
                subject: `New matches in ${hotSheet.name}`,
                variables: {
                  userName: sub.first_name || "there",
                  hotSheetName: hotSheet.name,
                  matchCount: newMatchListings.length,
                  listingsHtml: newMatchListingsHtml,
                  previewLink,
                  unsubscribeLink,
                },
              },
            });
            if (!error) {
              jobsQueued++;
              queuedForHotSheet++;
              markSent(newMatchListings);
            } else {
              console.error(`[send-new-match-notification] subscriber new-match enqueue failed:`, error);
            }
          }

          // One email per normalized status group per subscriber.
          for (const [statusKey, groupListings] of statusGroups) {
            if (groupListings.length === 0) continue;
            const copy = getHotSheetStatusCopy(statusKey);
            const sortedIds = groupListings
              .map((l: any) => String(l.id))
              .sort()
              .join(",");
            const dedupeKey = `hss:${sub.id}:hs:${hotSheet.id}:status:${statusKey}:${sortedIds}`;
            const html = renderCards(groupListings);
            const { error } = await supabase.from("email_jobs").insert({
              idempotency_key: dedupeKey,
              payload: {
                provider: "resend",
                template: "hot-sheet-subscriber-status-change",
                to: sub.email,
                subject: copy.subject(hotSheet.name),
                variables: {
                  userName: sub.first_name || "there",
                  hotSheetName: hotSheet.name,
                  statusKey,
                  matchCount: groupListings.length,
                  listingsHtml: html,
                  previewLink,
                  unsubscribeLink,
                },
              },
            });
            if (!error) {
              jobsQueued++;
              queuedForHotSheet++;
              markSent(groupListings);
            } else {
              console.error(`[send-new-match-notification] subscriber status-change (${statusKey}) enqueue failed:`, error);
            }
          }
        }
      }

      if (queuedForHotSheet > 0) {
        // Record dedup rows ONLY for (listing, status) pairs that successfully enqueued.
        // Failed enqueues stay eligible for retry on the next run.
        const sentRecords = Array.from(successfullySent).map((key) => {
          const [listing_id, status_at_send] = key.split("::");
          return {
            hot_sheet_id: hotSheet.id,
            listing_id,
            status_at_send: status_at_send || "active",
          };
        });

        if (sentRecords.length) {
          await supabase
            .from("hot_sheet_sent_listings")
            .upsert(sentRecords, { onConflict: "hot_sheet_id,listing_id,status_at_send" });

          const notificationRecords = sentRecords.map((r) => ({
            hot_sheet_id: hotSheet.id,
            listing_id: r.listing_id,
            user_id: hotSheet.user_id,
            notification_sent: true,
            notification_sent_at: new Date().toISOString(),
          }));
          await supabase.from("hot_sheet_notifications").insert(notificationRecords);
        }
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
