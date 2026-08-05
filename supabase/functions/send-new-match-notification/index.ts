import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { renderAgentHotSheetListingEmailCard, renderHotSheetMatchListingEmailCard } from "../_shared/listingEmailCard.ts";
import { enrichListingsWithListingAgentContact } from "../_shared/enrichListingsWithListingAgentContact.ts";
import { resolveEmailBaseUrl } from "../_shared/aacPublicUrl.ts";
import { getHotSheetStatusCopy, normalizeStatusKey, type HotSheetStatusKey } from "../_shared/hotSheetStatusCopy.ts";
import {
  agentIdempotencyKey,
  clientListingIdempotencyKey,
  filterMatchesToRequestedListing,
  hasClientsPendingAcceptance,
  isAgentEligibleForListing,
  mergeRecipientOutcomes,
  parseRequiredListingId,
  shouldCloseMatchEvent,
  subscriberListingIdempotencyKey,
  type DeliveryOutcome,
} from "../_shared/hotSheetAgentDelivery.ts";
import { assertHotSheetEnqueueAllowed } from "../_shared/emailStreams.ts";
import { authorizeInternalServiceRole } from "../_shared/internalServiceRoleAuth.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function isUniqueViolation(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === "23505" || Boolean(error.message?.toLowerCase().includes("duplicate"));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = authorizeInternalServiceRole(req);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Pause gate before any audience selection / matching.
    const pauseGate = assertHotSheetEnqueueAllowed();
    if (pauseGate.paused) {
      console.log(`[send-new-match-notification] paused: ${pauseGate.switch}`);
      return new Response(
        JSON.stringify({
          paused: true,
          switch: pauseGate.switch,
          reason: pauseGate.reason,
          jobsQueued: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Near-realtime path ONLY: a valid listing_id is required. There is no
    // unauthenticated full-scan fallback — catch-up/backfill must be a separate,
    // explicitly authorized admin operation.
    let triggerListingId: string | null = null;
    try {
      if (req.headers.get("content-type")?.includes("application/json")) {
        const body = await req.json().catch(() => null);
        triggerListingId = parseRequiredListingId(body?.listing_id);
      }
    } catch {
      triggerListingId = null;
    }

    if (!triggerListingId) {
      console.log("[send-new-match-notification] skipped: listing_id required");
      return new Response(
        JSON.stringify({
          processed: 0,
          jobsQueued: 0,
          reason: "listing_id required",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log(
      `[send-new-match-notification] near-realtime trigger for listing ${triggerListingId}`,
    );

    // Active Hot Sheets on the near-real-time path only.
    // Digest schedules must not send through this immediate matcher.
    // NOTE: There is currently no separate Hot Sheet daily/weekly digest worker
    // in this repo (process-comms-digests is Communications Center only).
    // Daily/weekly Hot Sheets are therefore not auto-delivered unless manually
    // invoked via process-hot-sheet with sendInitialBatch.
    const { data: hotSheets, error: fetchError } = await supabase
      .from("hot_sheets")
      .select("id, user_id, name, notify_agent_email, notification_schedule")
      .eq("is_active", true)
      .eq("notification_schedule", "immediately");

    if (fetchError) throw fetchError;

    if (!hotSheets || hotSheets.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          listing_id: triggerListingId,
          hotSheetsProcessed: 0,
          totalMatches: 0,
          jobsQueued: 0,
          message: "No hot sheets to process",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(
      `[send-new-match-notification] Processing ${hotSheets.length} hot sheets for listing ${triggerListingId}`,
    );

    let totalMatches = 0;
    let jobsQueued = 0;

    const appBaseUrl = resolveEmailBaseUrl(
      Deno.env.get("EMAIL_BASE_URL") ||
        Deno.env.get("APP_BASE_URL") ||
        Deno.env.get("SITE_URL"),
    );

    for (const hotSheet of hotSheets) {
      // Check for new matches (uses hot_sheet_sent_listings for match/event state)
      const { data: rpcMatches, error: matchError } = await supabase
        .rpc("check_hot_sheet_matches", { p_hot_sheet_id: hotSheet.id });

      if (matchError) continue;

      // Scope to the requested listing only — discard unrelated unsent matches.
      const matchingListings = filterMatchesToRequestedListing(
        rpcMatches,
        triggerListingId,
      );

      if (!matchingListings.length) continue;

      totalMatches += matchingListings.length;

      // Fetch only the requested listing (never other RPC candidates).
      const { data: listings } = await supabase
        .from("listings")
        .select("*")
        .eq("id", triggerListingId);

      if (!listings?.length) continue;

      // Hard scope: never process a row that isn't the requested listing.
      const scopedListings = listings.filter(
        (l: any) => String(l.id) === String(triggerListingId),
      );
      if (!scopedListings.length) continue;

      // Deterministic ordering
      scopedListings.sort((a: any, b: any) => String(a.id).localeCompare(String(b.id)));

      // Classify each listing as new-match vs status-change based on ALL prior sends
      const { data: priorSends } = await supabase
        .from("hot_sheet_sent_listings")
        .select("listing_id, status_at_send")
        .eq("hot_sheet_id", hotSheet.id)
        .eq("listing_id", triggerListingId);

      const priorStatusesByListing = new Map<string, Set<string>>();
      for (const row of priorSends || []) {
        const key = String((row as any).listing_id);
        const set = priorStatusesByListing.get(key) || new Set<string>();
        set.add(String((row as any).status_at_send || ""));
        priorStatusesByListing.set(key, set);
      }

      const newMatchListings: any[] = [];
      const statusChangeListings: any[] = [];
      for (const l of scopedListings) {
        const prior = priorStatusesByListing.get(String(l.id));
        const currentStatus = String(l.status || "active");
        if (!prior || prior.size === 0) {
          newMatchListings.push(l);
        } else if (prior.has(currentStatus)) {
          // Already recorded at this exact status — skip
          continue;
        } else {
          statusChangeListings.push(l);
        }
      }

      if (newMatchListings.length === 0 && statusChangeListings.length === 0) {
        continue;
      }

      const renderBuyerCards = (items: any[]) =>
        items
          .map((listing: any) => renderHotSheetMatchListingEmailCard(listing, { baseUrl: appBaseUrl }))
          .join("");

      // Agent-facing cards: enrich listing-agent contact + AAC agent card layout.
      const renderAgentCards = async (items: any[]) => {
        const enriched = await enrichListingsWithListingAgentContact(supabase, items);
        return enriched
          .map((listing: any) => renderAgentHotSheetListingEmailCard(listing, { baseUrl: appBaseUrl }))
          .join("");
      };

      // Group status-change listings by normalized current status for copy lookup.
      const statusGroups = new Map<HotSheetStatusKey, any[]>();
      for (const l of statusChangeListings) {
        const key = normalizeStatusKey(l.status);
        const bucket = statusGroups.get(key) || [];
        bucket.push(l);
        statusGroups.set(key, bucket);
      }

      // Per-listing/status delivery outcomes. hot_sheet_sent_listings is match/
      // event state only — a row is written only when every *needed* recipient
      // type for that listing has succeeded (or was skipped as ineligible).
      // Recipient dedupe is via per-listing email_jobs.idempotency_key values.
      const agentOutcome = new Map<string, DeliveryOutcome>();
      const clientOutcome = new Map<string, DeliveryOutcome>();
      const subscriberOutcome = new Map<string, DeliveryOutcome>();

      // Track per-recipient outcomes before merging into recipient-type maps.
      const clientPerListing = new Map<string, DeliveryOutcome[]>();
      const subscriberPerListing = new Map<string, DeliveryOutcome[]>();

      const listingKey = (l: any) => `${l.id}::${String(l.status || "active")}`;
      const allCandidateListings = [...newMatchListings, ...statusChangeListings];
      for (const l of allCandidateListings) {
        const key = listingKey(l);
        agentOutcome.set(key, "skipped");
        clientOutcome.set(key, "skipped");
        subscriberOutcome.set(key, "skipped");
        clientPerListing.set(key, []);
        subscriberPerListing.set(key, []);
      }

      const pushOutcome = (
        bag: Map<string, DeliveryOutcome[]>,
        items: any[],
        outcome: DeliveryOutcome,
      ) => {
        for (const l of items) {
          const key = listingKey(l);
          const arr = bag.get(key) || [];
          arr.push(outcome);
          bag.set(key, arr);
        }
      };

      const markAgentOutcome = (items: any[], outcome: DeliveryOutcome) => {
        for (const l of items) {
          const key = listingKey(l);
          const prev = agentOutcome.get(key) || "skipped";
          if (outcome === "failed") agentOutcome.set(key, "failed");
          else if (outcome === "success" && prev !== "failed") agentOutcome.set(key, "success");
        }
      };

      let queuedForHotSheet = 0;

      // ─── Agent delivery (before any client-only early exits) ─────────────
      {
        const { data: agentProfile } = await supabase
          .from("agent_profiles")
          .select("email, first_name")
          .eq("id", hotSheet.user_id)
          .maybeSingle();

        const agentEmail = agentProfile?.email
          ? String(agentProfile.email).toLowerCase().trim()
          : "";
        const agentFirstName = (agentProfile?.first_name || "").toString().trim() || "there";
        const agentHotSheetLink = `${appBaseUrl}/agent/hot-sheets`;

        const eligibleNew = newMatchListings.filter((listing) =>
          isAgentEligibleForListing(hotSheet, listing)
        );
        const eligibleStatus = [...statusGroups.entries()].flatMap(([statusKey, groupListings]) =>
          groupListings
            .filter((listing) => isAgentEligibleForListing(hotSheet, listing))
            .map((listing) => ({ statusKey, listing }))
        );

        if ((eligibleNew.length > 0 || eligibleStatus.length > 0) && !agentEmail) {
          console.log(
            `[send-new-match-notification] Agent email missing for hot sheet ${hotSheet.id}; agent delivery failed open`,
          );
          markAgentOutcome(eligibleNew, "failed");
          markAgentOutcome(
            eligibleStatus.map((x) => x.listing),
            "failed",
          );
        } else if (agentEmail) {
          for (const listing of eligibleNew) {
            const status = String(listing.status || "active");
            const idempotencyKey = agentIdempotencyKey(hotSheet.id, listing.id, status);
            const html = await renderAgentCards([listing]);
            const { error: insertError } = await supabase.from("email_jobs").insert({
              stream: "hot_sheet",
              idempotency_key: idempotencyKey,
              payload: {
                provider: "resend",
                template: "new-match-notification",
                to: agentEmail,
                subject: `New matches in your Hot Sheet: ${hotSheet.name}`,
                category: "hot_sheet_alerts",
                metadata: {
                  audience: "agent",
                  hot_sheet_id: hotSheet.id,
                  listing_id: listing.id,
                  status_at_send: status,
                },
                variables: {
                  userName: agentFirstName,
                  hotSheetName: hotSheet.name,
                  matchCount: 1,
                  listingsHtml: html,
                  hotSheetLink: agentHotSheetLink,
                },
              },
            });

            if (!insertError || isUniqueViolation(insertError)) {
              if (!insertError) {
                jobsQueued++;
                queuedForHotSheet++;
              }
              markAgentOutcome([listing], "success");
            } else {
              console.error(
                `[send-new-match-notification] agent new-match enqueue failed for ${agentEmail}:`,
                insertError,
              );
              markAgentOutcome([listing], "failed");
            }
          }

          for (const { statusKey, listing } of eligibleStatus) {
            const copy = getHotSheetStatusCopy(statusKey);
            const status = String(listing.status || "active");
            const idempotencyKey = agentIdempotencyKey(hotSheet.id, listing.id, status);
            const html = await renderAgentCards([listing]);
            const { error: insertError } = await supabase.from("email_jobs").insert({
              stream: "hot_sheet",
              idempotency_key: idempotencyKey,
              payload: {
                provider: "resend",
                template: "hot-sheet-status-change",
                to: agentEmail,
                subject: copy.subject(hotSheet.name),
                category: "hot_sheet_alerts",
                metadata: {
                  audience: "agent",
                  hot_sheet_id: hotSheet.id,
                  listing_id: listing.id,
                  status_at_send: status,
                  status_key: statusKey,
                },
                variables: {
                  userName: agentFirstName,
                  hotSheetName: hotSheet.name,
                  statusKey,
                  matchCount: 1,
                  listingsHtml: html,
                  hotSheetLink: agentHotSheetLink,
                },
              },
            });

            if (!insertError || isUniqueViolation(insertError)) {
              if (!insertError) {
                jobsQueued++;
                queuedForHotSheet++;
              }
              markAgentOutcome([listing], "success");
            } else {
              console.error(
                `[send-new-match-notification] agent status-change (${statusKey}) enqueue failed for ${agentEmail}:`,
                insertError,
              );
              markAgentOutcome([listing], "failed");
            }
          }
        }
      }

      // ─── Client delivery (acceptance gates apply ONLY here) ─────────────
      const { data: hotSheetClients, error: clientsError } = await supabase
        .from("hot_sheet_clients")
        .select("client_id, clients(email, first_name)")
        .eq("hot_sheet_id", hotSheet.id);

      let clientLookupFailed = false;
      let assignedClients: any[] = [];
      let acceptedRecipients: Array<{
        clientId: string | null;
        email: string;
        firstName: string;
        acceptedAt: string | null;
        suppressInitial: boolean;
      }> = [];

      if (clientsError) {
        clientLookupFailed = true;
        console.error(
          `[send-new-match-notification] hot_sheet_clients lookup failed for ${hotSheet.id}:`,
          clientsError,
        );
        // Do not treat lookup failure as "no clients" — keep event retryable.
        for (const l of allCandidateListings) {
          clientOutcome.set(listingKey(l), "failed");
        }
      } else {
        assignedClients = hotSheetClients ?? [];

        if (assignedClients.length > 0) {
          const { data: acceptedTokens, error: tokenError } = await supabase
            .from("share_tokens")
            .select("accepted_at, payload")
            .eq("agent_id", hotSheet.user_id)
            .eq("payload->>type", "client_hotsheet_invite")
            .eq("payload->>hot_sheet_id", hotSheet.id)
            .not("accepted_at", "is", null);

          if (tokenError) {
            clientLookupFailed = true;
            console.error(
              `[send-new-match-notification] share_tokens lookup failed for ${hotSheet.id}:`,
              tokenError,
            );
            for (const l of allCandidateListings) {
              clientOutcome.set(listingKey(l), "failed");
            }
          } else if (!acceptedTokens?.length) {
            console.log(
              `[send-new-match-notification] Skipping client delivery for ${hotSheet.id}: no accepted invite tokens`,
            );
          } else {
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

            acceptedRecipients = assignedClients
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
              .filter((recipient): recipient is {
                clientId: string | null;
                email: string;
                firstName: string;
                acceptedAt: string | null;
                suppressInitial: boolean;
              } => Boolean(recipient.email) && Boolean(recipient.acceptedAt));

            if (!acceptedRecipients.length) {
              console.log(
                `[send-new-match-notification] Skipping client delivery for ${hotSheet.id}: recipients not accepted yet`,
              );
            }
          }
        } else {
          console.log(
            `[send-new-match-notification] No assigned clients for ${hotSheet.id}; client delivery skipped`,
          );
        }
      }

      // Keep event open while ANY assigned client has not accepted yet.
      const clientsPendingAcceptance = hasClientsPendingAcceptance({
        assignedCount: assignedClients.length,
        acceptedCount: acceptedRecipients.length,
        lookupFailed: clientLookupFailed,
      });

      if (!clientLookupFailed && acceptedRecipients.length > 0) {
        for (const recipient of acceptedRecipients) {
          const recipientKey = recipient.clientId || recipient.email;
          const filterInitial = (items: any[]) => {
            if (!(recipient.suppressInitial && recipient.acceptedAt)) return items;
            const cutoff = new Date(recipient.acceptedAt).getTime();
            return items.filter((l: any) => {
              const ts = l.created_at || l.updated_at;
              if (!ts) return false;
              return new Date(ts).getTime() > cutoff;
            });
          };

          // Per-listing delivery so shrinking retry batches cannot create a new
          // batch key and resend a previously delivered listing.
          for (const listing of filterInitial(newMatchListings)) {
            const status = String(listing.status || "active");
            const dedupeKey = clientListingIdempotencyKey(
              recipientKey,
              hotSheet.id,
              listing.id,
              status,
            );
            const html = renderBuyerCards([listing]);
            const { error: insertError } = await supabase.from("email_jobs").insert({
              stream: "hot_sheet",
              idempotency_key: dedupeKey,
              payload: {
                provider: "resend",
                template: "new-match-notification",
                to: recipient.email,
                subject: `New matches in your Hot Sheet: ${hotSheet.name}`,
                category: "hot_sheet_alerts",
                metadata: {
                  audience: "client",
                  hot_sheet_id: hotSheet.id,
                  listing_id: listing.id,
                  status_at_send: status,
                },
                variables: {
                  userName: recipient.firstName || "there",
                  hotSheetName: hotSheet.name,
                  matchCount: 1,
                  listingsHtml: html,
                  hotSheetLink: `${appBaseUrl}/client/hot-sheets/${hotSheet.id}`,
                },
              },
            });
            if (!insertError || isUniqueViolation(insertError)) {
              if (!insertError) {
                jobsQueued++;
                queuedForHotSheet++;
              }
              pushOutcome(clientPerListing, [listing], "success");
            } else {
              console.error(
                `[send-new-match-notification] enqueue new-match failed for ${recipient.email}:`,
                insertError,
              );
              pushOutcome(clientPerListing, [listing], "failed");
            }
          }

          for (const [statusKey, groupListings] of statusGroups) {
            const copy = getHotSheetStatusCopy(statusKey);
            for (const listing of filterInitial(groupListings)) {
              const status = String(listing.status || "active");
              const dedupeKey = clientListingIdempotencyKey(
                recipientKey,
                hotSheet.id,
                listing.id,
                status,
              );
              const html = renderBuyerCards([listing]);
              const { error: insertError } = await supabase.from("email_jobs").insert({
                stream: "hot_sheet",
                idempotency_key: dedupeKey,
                payload: {
                  provider: "resend",
                  template: "hot-sheet-status-change",
                  to: recipient.email,
                  subject: copy.subject(hotSheet.name),
                  category: "hot_sheet_alerts",
                  metadata: {
                    audience: "client",
                    hot_sheet_id: hotSheet.id,
                    listing_id: listing.id,
                    status_at_send: status,
                    status_key: statusKey,
                  },
                  variables: {
                    userName: recipient.firstName || "there",
                    hotSheetName: hotSheet.name,
                    statusKey,
                    matchCount: 1,
                    listingsHtml: html,
                    hotSheetLink: `${appBaseUrl}/client/hot-sheets/${hotSheet.id}`,
                  },
                },
              });
              if (!insertError || isUniqueViolation(insertError)) {
                if (!insertError) {
                  jobsQueued++;
                  queuedForHotSheet++;
                }
                pushOutcome(clientPerListing, [listing], "success");
              } else {
                console.error(
                  `[send-new-match-notification] enqueue status-change (${statusKey}) failed for ${recipient.email}:`,
                  insertError,
                );
                pushOutcome(clientPerListing, [listing], "failed");
              }
            }
          }
        }

        for (const l of allCandidateListings) {
          const key = listingKey(l);
          const merged = mergeRecipientOutcomes(clientPerListing.get(key) || []);
          if (merged !== "skipped") clientOutcome.set(key, merged);
        }
      }

      // ─── Email subscribers (no-account "Add a Friend") ───────────────────
      // Independent of client acceptance / assignment.
      const { data: subscribers, error: subscribersError } = await supabase
        .from("hot_sheet_subscribers" as any)
        .select("id, email, first_name, unsubscribe_token, preview_token")
        .eq("hot_sheet_id", hotSheet.id)
        .eq("status", "active");

      if (subscribersError) {
        console.error(
          `[send-new-match-notification] hot_sheet_subscribers lookup failed for ${hotSheet.id}:`,
          subscribersError,
        );
        for (const l of allCandidateListings) {
          subscriberOutcome.set(listingKey(l), "failed");
        }
      } else if (subscribers?.length) {
        for (const sub of subscribers) {
          const previewLink = `${appBaseUrl}/hotsheet-preview?token=${(sub as any).preview_token}`;
          const unsubscribeLink = `${appBaseUrl}/unsubscribe-hotsheet?token=${sub.unsubscribe_token}`;
          const subId = String(sub.id);

          for (const listing of newMatchListings) {
            const status = String(listing.status || "active");
            const dedupeKey = subscriberListingIdempotencyKey(
              subId,
              hotSheet.id,
              listing.id,
              status,
            );
            const html = renderBuyerCards([listing]);
            const { error } = await supabase.from("email_jobs").insert({
              stream: "hot_sheet",
              idempotency_key: dedupeKey,
              payload: {
                provider: "resend",
                template: "hot-sheet-subscriber-update",
                to: sub.email,
                subject: `New matches in ${hotSheet.name}`,
                category: "hot_sheet_alerts",
                metadata: {
                  audience: "subscriber",
                  hot_sheet_id: hotSheet.id,
                  listing_id: listing.id,
                  status_at_send: status,
                },
                variables: {
                  userName: sub.first_name || "there",
                  hotSheetName: hotSheet.name,
                  matchCount: 1,
                  listingsHtml: html,
                  previewLink,
                  unsubscribeLink,
                },
              },
            });
            if (!error || isUniqueViolation(error)) {
              if (!error) {
                jobsQueued++;
                queuedForHotSheet++;
              }
              pushOutcome(subscriberPerListing, [listing], "success");
            } else {
              console.error(
                `[send-new-match-notification] subscriber new-match enqueue failed:`,
                error,
              );
              pushOutcome(subscriberPerListing, [listing], "failed");
            }
          }

          for (const [statusKey, groupListings] of statusGroups) {
            const copy = getHotSheetStatusCopy(statusKey);
            for (const listing of groupListings) {
              const status = String(listing.status || "active");
              const dedupeKey = subscriberListingIdempotencyKey(
                subId,
                hotSheet.id,
                listing.id,
                status,
              );
              const html = renderBuyerCards([listing]);
              const { error } = await supabase.from("email_jobs").insert({
                stream: "hot_sheet",
                idempotency_key: dedupeKey,
                payload: {
                  provider: "resend",
                  template: "hot-sheet-subscriber-status-change",
                  to: sub.email,
                  subject: copy.subject(hotSheet.name),
                  category: "hot_sheet_alerts",
                  metadata: {
                    audience: "subscriber",
                    hot_sheet_id: hotSheet.id,
                    listing_id: listing.id,
                    status_at_send: status,
                    status_key: statusKey,
                  },
                  variables: {
                    userName: sub.first_name || "there",
                    hotSheetName: hotSheet.name,
                    statusKey,
                    matchCount: 1,
                    listingsHtml: html,
                    previewLink,
                    unsubscribeLink,
                  },
                },
              });
              if (!error || isUniqueViolation(error)) {
                if (!error) {
                  jobsQueued++;
                  queuedForHotSheet++;
                }
                pushOutcome(subscriberPerListing, [listing], "success");
              } else {
                console.error(
                  `[send-new-match-notification] subscriber status-change (${statusKey}) enqueue failed:`,
                  error,
                );
                pushOutcome(subscriberPerListing, [listing], "failed");
              }
            }
          }
        }

        for (const l of allCandidateListings) {
          const key = listingKey(l);
          // Don't overwrite an earlier lookup-failure "failed".
          if (subscriberOutcome.get(key) === "failed") continue;
          const merged = mergeRecipientOutcomes(subscriberPerListing.get(key) || []);
          if (merged !== "skipped") subscriberOutcome.set(key, merged);
        }
      }

      // Record match/event state ONLY for listings where every needed recipient
      // type succeeded (or was ineligible/skipped). Failed agent/client/subscriber
      // enqueues remain retryable independently via recipient idempotency keys.
      const sentRecords: Array<{
        hot_sheet_id: string;
        listing_id: string;
        status_at_send: string;
      }> = [];

      for (const l of allCandidateListings) {
        const key = listingKey(l);
        const agent = agentOutcome.get(key) || "skipped";
        const client = clientOutcome.get(key) || "skipped";
        const subscriber = subscriberOutcome.get(key) || "skipped";

        if (
          !shouldCloseMatchEvent({
            agent,
            client,
            subscriber,
            clientsPendingAcceptance,
          })
        ) {
          continue;
        }

        sentRecords.push({
          hot_sheet_id: hotSheet.id,
          listing_id: String(l.id),
          status_at_send: String(l.status || "active"),
        });
      }

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
      } else if (queuedForHotSheet > 0) {
        console.log(
          `[send-new-match-notification] Hot sheet ${hotSheet.id}: queued ${queuedForHotSheet} job(s) but deferred hot_sheet_sent_listings (pending recipient types remain)`,
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        listing_id: triggerListingId,
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
