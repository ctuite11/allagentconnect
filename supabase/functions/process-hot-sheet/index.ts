import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { renderHotSheetMatchListingEmailCard } from "../_shared/listingEmailCard.ts";
import { resolveEmailBaseUrl } from "../_shared/aacPublicUrl.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ProcessHotSheetRequest {
  hotSheetId: string;
  sendInitialBatch?: boolean;
  selectedListingIds?: string[];
  /**
   * Baseline-only mode: record all currently matching listings as "sent" for this
   * hot sheet (insert into hot_sheet_sent_listings) WITHOUT sending any email and
   * WITHOUT respecting the 60s cooldown. Used at buyer invite acceptance time so
   * the buyer dashboard's "New Matches" stat starts at 0.
   */
  baselineOnly?: boolean;
  /** Manual, recipient-specific send (attached hot_sheet_clients ids). */
  recipientClientIds?: string[];
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // Admin client for bypassing RLS when fetching client emails and inserting email_jobs
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { hotSheetId, sendInitialBatch = false, selectedListingIds, baselineOnly = false, recipientClientIds }: ProcessHotSheetRequest = await req.json();

    console.log("Processing hot sheet:", hotSheetId, { sendInitialBatch, selectedListingCount: selectedListingIds?.length });

    // Get hot sheet with client info from junction table
    const { data: hotSheet, error: hotSheetError } = await supabaseClient
      .from("hot_sheets")
      .select("*")
      .eq("id", hotSheetId)
      .single();

    if (hotSheetError) throw hotSheetError;
    if (!hotSheet) throw new Error("Hot sheet not found");

    // ── Recipient-specific manual send (Hot Sheet Review / invite acceptance) ──
    // Isolated from the automatic/legacy path below. hot_sheet_recipient_batches
    // is the dedupe/source of truth for each recipient's FIRST batch: those IDs
    // are sent even if already present in the Hot-Sheet-wide
    // hot_sheet_sent_listings. Subsequent manual sends keep the normal filter.
    if (Array.isArray(recipientClientIds) && recipientClientIds.length > 0) {
      const authHeader = req.headers.get("Authorization") ?? "";
      const isServiceRole = authHeader === `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`;
      if (!isServiceRole) {
        // Pass the caller's JWT explicitly: a server-side client has no stored
        // session, so getUser() without the token always returns no user.
        // Never log the token.
        const callerJwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
        const { data: userData, error: userErr } = callerJwt
          ? await supabaseClient.auth.getUser(callerJwt)
          : { data: { user: null }, error: null };
        const uid = userData?.user?.id;
        let allowed = !!uid && uid === hotSheet.user_id;
        if (!allowed && uid) {
          const { data: canAct } = await supabaseClient.rpc("can_act_for_agent", { p_agent_user_id: hotSheet.user_id });
          allowed = canAct === true;
        }
        if (!allowed) {
          console.warn("[process-hot-sheet] recipient send rejected:", userErr ? "auth lookup failed" : uid ? "not owner/delegate" : "no user");
          return new Response(JSON.stringify({ error: "Not allowed" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      const { data: attached } = await adminClient
        .from("hot_sheet_clients")
        .select("client_id, clients ( id, first_name, last_name, email )")
        .eq("hot_sheet_id", hotSheetId)
        .in("client_id", recipientClientIds);

      const { data: batchRows } = await adminClient
        .from("hot_sheet_recipient_batches")
        .select("*")
        .eq("hot_sheet_id", hotSheetId)
        .in("client_id", recipientClientIds);
      const batchByClient = new Map((batchRows ?? []).map((b: any) => [String(b.client_id), b]));

      const { data: rels } = await adminClient
        .from("client_agent_relationships")
        .select("client_id, crm_client_id")
        .eq("agent_id", hotSheet.user_id)
        .eq("status", "active")
        .is("ended_at", null)
        .in("crm_client_id", recipientClientIds);
      const buyerUserByCrm = new Map(
        (rels ?? []).filter((r: any) => r.client_id).map((r: any) => [String(r.crm_client_id), String(r.client_id)]),
      );

      const { data: sentRows } = await adminClient
        .from("hot_sheet_sent_listings")
        .select("listing_id")
        .eq("hot_sheet_id", hotSheetId);
      const hotSheetSent = new Set((sentRows ?? []).map((r: any) => String(r.listing_id)));

      const { data: agentProfile } = await adminClient
        .from("agent_profiles")
        .select("email, first_name")
        .eq("id", hotSheet.user_id)
        .maybeSingle();

      const baseUrl = resolveEmailBaseUrl(Deno.env.get("EMAIL_BASE_URL"));
      const nowIso = new Date().toISOString();
      const results: Array<{ clientId: string; state: string; count?: number }> = [];
      const queuedListingIds = new Set<string>();
      const listingCache = new Map<string, any>();

      const loadListings = async (ids: string[]) => {
        const missing = ids.filter((i) => !listingCache.has(i));
        if (missing.length > 0) {
          const { data } = await adminClient.from("listings").select("*").in("id", missing);
          for (const l of data ?? []) listingCache.set(String(l.id), l);
        }
        return ids.map((i) => listingCache.get(i)).filter(Boolean);
      };

      for (const row of attached ?? []) {
        const clientId = String(row.client_id);
        const client: any = Array.isArray(row.clients) ? row.clients[0] : row.clients;
        const email = client?.email?.toLowerCase().trim();
        const batch = batchByClient.get(clientId);
        const firstBatchPending = !batch?.initial_batch_queued_at;
        const buyerUserId = buyerUserByCrm.get(clientId) ?? null;
        const requested = (selectedListingIds ?? []).map(String);

        if (!email) { results.push({ clientId, state: "missing_email" }); continue; }

        if (!buyerUserId) {
          // Pending buyer: store their first batch with the invitation; nothing is sent now.
          if (requested.length > 0 && firstBatchPending) {
            await adminClient.from("hot_sheet_recipient_batches").upsert({
              hot_sheet_id: hotSheetId,
              client_id: clientId,
              initial_listing_ids: requested,
              invited_at: batch?.invited_at ?? nowIso,
              updated_at: nowIso,
            }, { onConflict: "hot_sheet_id,client_id" });
          }
          results.push({ clientId, state: "pending_invite" });
          continue;
        }

        let ids: string[];
        if (firstBatchPending) {
          const stored = (batch?.initial_listing_ids ?? []).map(String);
          ids = requested.length > 0 ? requested : stored; // bypass Hot-Sheet-wide filter
        } else {
          ids = requested.filter((i) => !hotSheetSent.has(i)); // normal filter for later sends
        }
        const listings = await loadListings(ids);
        if (listings.length === 0) { results.push({ clientId, state: "nothing_to_send" }); continue; }

        const accessUrl = `${baseUrl}/client/hot-sheets/${hotSheetId}`;
        let listingsHtml = listings.slice(0, 5)
          .map((l: any) => renderHotSheetMatchListingEmailCard(l, { baseUrl })).join("");
        if (listings.length > 5) {
          listingsHtml += `<p style="color: #6b7280; margin: 16px 0;">And ${listings.length - 5} more ${listings.length - 5 === 1 ? "property" : "properties"}...</p>`;
        }
        listingsHtml += `
          <div style="margin-top: 32px; padding: 16px; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px;">
            <p style="margin: 0 0 12px 0; color: #1f2937;">View all properties and add comments:</p>
            <a href="${accessUrl}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">View Hot Sheet</a>
          </div>`;
        const clientName = `${client?.first_name ?? ""} ${client?.last_name ?? ""}`.trim() || "Client";
        const keyIds = listings.map((l: any) => String(l.id)).sort().join(",");

        const { error: jobErr } = await adminClient.from("email_jobs").insert({
          idempotency_key: `hotsheet-recipient-batch:${hotSheetId}:${clientId}:${firstBatchPending ? "initial" : nowIso}:${keyIds}`.slice(0, 500),
          payload: {
            provider: "resend",
            template: "hot-sheet-alert",
            to: [email],
            subject: `${listings.length} New Properties Match Your Search - ${hotSheet.name}`,
            variables: { userName: clientName, hotSheetName: hotSheet.name, matchCount: listings.length, listingsHtml },
          },
        });
        if (jobErr) {
          console.error("[process-hot-sheet] recipient batch enqueue failed", clientId, jobErr.message);
          results.push({ clientId, state: "failed" });
          continue;
        }

        if (agentProfile?.email) {
          await adminClient.from("email_jobs").insert({
            idempotency_key: `hotsheet-agent-copy:${hotSheetId}:${clientId}:${Date.now()}`,
            payload: {
              provider: "resend",
              template: "hot-sheet-alert",
              to: [agentProfile.email.toLowerCase().trim()],
              subject: `Copy: Hot Sheet sent to ${clientName}`,
              variables: {
                userName: agentProfile.first_name || "there",
                hotSheetName: hotSheet.name,
                matchCount: listings.length,
                listingsHtml: `<div style="margin: 0 0 16px 0; padding: 12px 16px; background-color: #f3f4f6; border-radius: 8px; color: #374151; font-size: 13px;"><strong>Copy of what your buyer received</strong><br>Sent to: ${clientName} (${email})<br>Hot Sheet: ${hotSheet.name}</div>${listingsHtml}`,
              },
            },
          }).then(({ error }) => { if (error) console.warn("[process-hot-sheet] agent copy failed", error.message); });
        }

        if (firstBatchPending) {
          await adminClient.from("hot_sheet_recipient_batches").upsert({
            hot_sheet_id: hotSheetId,
            client_id: clientId,
            initial_listing_ids: listings.map((l: any) => String(l.id)),
            invited_at: batch?.invited_at ?? null,
            initial_batch_queued_at: nowIso,
            recipient_user_id: buyerUserId,
            updated_at: nowIso,
          }, { onConflict: "hot_sheet_id,client_id" });
        }
        for (const l of listings) queuedListingIds.add(String(l.id));
        results.push({ clientId, state: "queued", count: listings.length });
      }

      if (queuedListingIds.size > 0) {
        const rows = [...queuedListingIds].map((id) => ({
          hot_sheet_id: hotSheetId,
          listing_id: id,
          status_at_send: listingCache.get(id)?.status || "active",
        }));
        await adminClient.from("hot_sheet_sent_listings")
          .upsert(rows, { onConflict: "hot_sheet_id,listing_id", ignoreDuplicates: true });
        await adminClient.from("hot_sheets").update({ last_sent_at: nowIso }).eq("id", hotSheetId);
      }

      return new Response(JSON.stringify({ success: true, recipients: results }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cooldown check: skip if sent within last 60 seconds (not applied for baseline-only writes)
    if (!baselineOnly && hotSheet.last_sent_at) {
      const lastSentTime = new Date(hotSheet.last_sent_at).getTime();
      const now = Date.now();
      const cooldownSeconds = 60;
      const secondsSinceLastSend = (now - lastSentTime) / 1000;

      if (secondsSinceLastSend < cooldownSeconds) {
        console.log(`Cooldown active: last sent ${secondsSinceLastSend.toFixed(0)}s ago (< ${cooldownSeconds}s) - skipping duplicate send`);
        return new Response(
          JSON.stringify({ 
            message: "Hot sheet was sent recently. Please wait before sending again.",
            cooldownRemaining: Math.ceil(cooldownSeconds - secondsSinceLastSend)
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }
    
    // Fetch clients using admin client to bypass RLS
    const { data: hotSheetClients, error: clientsError } = await adminClient
      .from("hot_sheet_clients")
      .select(`
        client_id,
        clients (
          first_name,
          last_name,
          email,
          phone
        )
      `)
      .eq("hot_sheet_id", hotSheetId);

    console.log("Fetched clients for hot sheet:", hotSheetClients?.length || 0);

    // Fetch accepted tokens for this hot sheet (gate: only accepted clients get match emails)
    // NOTE: share_tokens has NO top-level 'type', 'client_id', or 'client_email' columns.
    // Those fields only exist inside the payload JSONB. Filter by payload.type in JS below.
    const { data: acceptedTokens, error: tokenErr } = await adminClient
      .from("share_tokens")
      .select("payload, accepted_at, revoked_at")
      .eq("agent_id", hotSheet.user_id)
      .not("accepted_at", "is", null)
      .is("revoked_at", null);

    if (tokenErr) {
      console.warn("Warning: could not fetch accepted tokens:", tokenErr.message);
    }

    const hotSheetIdStr = String(hotSheet.id);

    const acceptedForThisHotSheet = (acceptedTokens ?? []).filter((t: any) => {
      const p = t.payload ?? {};
      // Belt+suspenders: warn on malformed tokens
      if (!p.type) {
        console.warn("[process-hot-sheet] Token missing payload.type:", p);
      }
      if (p.type === "client_hotsheet_invite" && !p.hot_sheet_id) {
        console.warn("[process-hot-sheet] Hotsheet invite token missing payload.hot_sheet_id:", p);
      }
      // Filter by type in JS (not a top-level column) and hot_sheet_id match
      return (
        p.type === "client_hotsheet_invite" &&
        String(p.hot_sheet_id ?? "") === hotSheetIdStr
      );
    });

    // client_id and client_email are NOT top-level columns — read exclusively from payload
    const acceptedClientIds = new Set(
      acceptedForThisHotSheet
        .map((t: any) => t.payload?.client_id)
        .filter(Boolean)
        .map((x: any) => String(x))
    );

    const acceptedEmails = new Set(
      acceptedForThisHotSheet
        .map((t: any) => t.payload?.client_email)
        .filter(Boolean)
        .map((e: string) => e.toLowerCase().trim())
    );

    console.log(`Accepted clients for hot sheet ${hotSheetIdStr}: IDs=${[...acceptedClientIds].join(",") || "none"}, emails=${[...acceptedEmails].join(",") || "none"}`);

    console.log("Hot sheet criteria:", hotSheet.criteria);

    // Build query to match listings
    // Use admin client for baseline-only writes (invoked by service-role flow at
    // buyer invite acceptance time — buyer cannot see the agent's listings via RLS).
    let query = (baselineOnly ? adminClient : supabaseClient)
      .from("listings")
      .select("*");

    const criteria = hotSheet.criteria || {};

    // Map criteria property type values to database values
    const propertyTypeMap: Record<string, string> = {
      'single_family': 'Single Family',
      'condo': 'condo',
      'Condominium': 'condo',
      'multi_family': 'Multi Family',
      'townhouse': 'Townhouse',
      'land': 'Land',
      'commercial': 'Commercial',
      'business_opp': 'Business Opportunity'
    };

    // Apply filters based on criteria
    if (criteria.propertyTypes && criteria.propertyTypes.length > 0) {
      const mappedTypes = criteria.propertyTypes.map((type: string) => 
        propertyTypeMap[type] || type
      );
      query = query.in("property_type", mappedTypes);
    }

    if (criteria.statuses && criteria.statuses.length > 0) {
      query = query.in("status", criteria.statuses);
    } else {
      // Default to match pipeline statuses
      query = query.in("status", ["active", "new", "coming_soon", "off_market", "back_on_market"]);
    }
    if (criteria.minPrice) {
      query = query.gte("price", criteria.minPrice);
    }

    if (criteria.maxPrice) {
      query = query.lte("price", criteria.maxPrice);
    }

    if (criteria.bedrooms) {
      query = query.gte("bedrooms", criteria.bedrooms);
    }

    if (criteria.bathrooms) {
      query = query.gte("bathrooms", criteria.bathrooms);
    }

    if (criteria.minSqft) {
      query = query.gte("square_feet", criteria.minSqft);
    }

    if (criteria.maxSqft) {
      query = query.lte("square_feet", criteria.maxSqft);
    }

    if (criteria.city) {
      query = query.ilike("city", `%${criteria.city}%`);
    }

    if (criteria.zipCode) {
      query = query.eq("zip_code", criteria.zipCode);
    }

    if (criteria.state) {
      query = query.eq("state", criteria.state);
    }

    // Handle cities with neighborhoods
    if (criteria.cities && criteria.cities.length > 0) {
      const cityFilters = criteria.cities.map((cityStr: string) => {
        const parts = cityStr.split(',');
        const cityPart = parts[0].trim();
        
        // Check if it's a city-neighborhood format (e.g., "Boston-Charlestown")
        if (cityPart.includes('-')) {
          const [city, neighborhood] = cityPart.split('-').map((s: string) => s.trim());
          return { city, neighborhood };
        }
        
        return { city: cityPart, neighborhood: null };
      });
      
      // Group by cities that have neighborhoods vs just cities
      const citiesWithNeighborhoods = cityFilters.filter((f: {city: string, neighborhood: string | null}) => f.neighborhood);
      const citiesOnly = cityFilters.filter((f: {city: string, neighborhood: string | null}) => !f.neighborhood).map((f: {city: string, neighborhood: string | null}) => f.city);
      
      // Build complex filter: use PostgREST wildcard "*" with ilike (case-insensitive)
      const wild = (v: string) => `*${String(v).replace(/[*",]/g, ' ').trim()}*`;
      if (citiesWithNeighborhoods.length > 0 || citiesOnly.length > 0) {
        const segments: string[] = [];
        if (citiesOnly.length > 0) {
          segments.push(...citiesOnly.map((c: string) => `city.ilike.${wild(c)}`));
        }
        if (citiesWithNeighborhoods.length > 0) {
          segments.push(
            ...citiesWithNeighborhoods.map((f: {city: string, neighborhood: string | null}) => `and(city.ilike.${wild(f.city)},neighborhood.ilike.${wild(f.neighborhood!)})`)
          );
        }
        query = query.or(segments.join(','));
      }
    }

    const { data: matchingListings, error: listingsError } = await query.order("created_at", { ascending: false });

    if (listingsError) throw listingsError;

    console.log("Found matching listings:", matchingListings?.length || 0);

    // Baseline-only short-circuit: record everything as already sent, skip email.
    if (baselineOnly) {
      const rows = (matchingListings ?? []).map((l: any) => ({
        hot_sheet_id: hotSheetId,
        listing_id: l.id,
        status_at_send: l.status || 'active',
      }));
      if (rows.length > 0) {
        await adminClient
          .from("hot_sheet_sent_listings")
          .upsert(rows, { onConflict: "hot_sheet_id,listing_id", ignoreDuplicates: true });
      }
      return new Response(
        JSON.stringify({ success: true, baseline: rows.length }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get already sent listings
    const { data: sentListings } = await supabaseClient
      .from("hot_sheet_sent_listings")
      .select("listing_id")
      .eq("hot_sheet_id", hotSheetId);

    const sentListingIds = new Set(sentListings?.map(sl => sl.listing_id) || []);

    // Filter out already sent listings or use selected listings
    let newListings;
    if (selectedListingIds && selectedListingIds.length > 0) {
      // Use only the selected listings
      newListings = matchingListings?.filter(listing => 
        selectedListingIds.includes(listing.id) && !sentListingIds.has(listing.id)
      ) || [];
    } else {
      // Use all new listings not yet sent
      newListings = matchingListings?.filter(listing => !sentListingIds.has(listing.id)) || [];
    }

    console.log("New listings to send:", newListings.length);

    if (newListings.length === 0) {
      return new Response(
        JSON.stringify({ message: "No new listings found", matchingCount: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send email if requested or if notification settings allow
    const shouldSendEmail = sendInitialBatch || 
      (hotSheet.notification_schedule === "immediately" && 
       (hotSheet.notify_client_email || hotSheet.notify_agent_email));

    console.log("Send decision:", { 
      shouldSendEmail, 
      sendInitialBatch, 
      notifyAgent: hotSheet.notify_agent_email, 
      notifyClient: hotSheet.notify_client_email,
      schedule: hotSheet.notification_schedule 
    });

    if (shouldSendEmail) {
      const recipientSet = new Set<string>();
      
      if (hotSheet.notify_agent_email) {
        const { data: agentProfile } = await supabaseClient
          .from("agent_profiles")
          .select("email, first_name")
          .eq("id", hotSheet.user_id)
          .single();
        
        if (agentProfile?.email) {
          recipientSet.add(agentProfile.email.toLowerCase().trim());
          console.log("Added agent email:", agentProfile.email);
        }
      }

      if (hotSheet.notify_client_email) {
        // Gate: only send match emails to clients who have ACCEPTED their invite for this hot sheet

        // Get client emails from criteria first (legacy path)
        if (hotSheet.criteria?.clientEmail) {
          const email = hotSheet.criteria.clientEmail.toLowerCase().trim();
          if (acceptedEmails.has(email)) {
            recipientSet.add(email);
            console.log("Added accepted client email from criteria:", email);
          } else {
            console.log("Skipping criteria.clientEmail (invite not yet accepted):", email);
          }
        }
        
        // Add clients from junction table — only if they have an accepted invite
        if (hotSheetClients && hotSheetClients.length > 0) {
          hotSheetClients.forEach((hsc: any) => {
            const email = hsc.clients?.email?.toLowerCase().trim();
            if (!email) return;
            const hasAcceptedById = hsc.client_id && acceptedClientIds.has(String(hsc.client_id));
            const hasAcceptedByEmail = acceptedEmails.has(email);
            if (hasAcceptedById || hasAcceptedByEmail) {
              recipientSet.add(email);
              console.log("Added accepted client email from junction:", email);
            } else {
              console.log("Skipping client (invite not yet accepted):", email);
            }
          });
        }
      }

      const recipients = Array.from(recipientSet);
      console.log("Final recipients (deduplicated):", recipients);

      if (recipients.length > 0) {
        // Create share token BEFORE sending email
        const token = crypto.randomUUID();
        console.log("Creating share token for client hotsheet:", {
          token,
          hot_sheet_id: hotSheet.id,
          agent_id: hotSheet.user_id,
          client_id: hotSheet.client_id
        });
        
        // Get client email from hot_sheet_clients junction table OR from criteria
        let clientEmail = null;
        let clientFirstName: string | null = null;
        let clientLastName: string | null = null;
        let clientPhone: string | null = null;

        // First try: Junction table
        if (hotSheetClients && hotSheetClients.length > 0) {
          const firstClient = Array.isArray(hotSheetClients[0].clients)
            ? hotSheetClients[0].clients[0]
            : hotSheetClients[0].clients;
          if (firstClient && firstClient.email) {
            clientEmail = firstClient.email;
            clientFirstName = firstClient.first_name ?? null;
            clientLastName = firstClient.last_name ?? null;
            clientPhone = (firstClient as { phone?: string | null }).phone ?? null;
            console.log("Found client email from junction table:", clientEmail);
          }
        }
        
        // Second try: Hot sheet criteria (legacy)
        if (!clientEmail && hotSheet.criteria?.clientEmail) {
          clientEmail = hotSheet.criteria.clientEmail;
          console.log("Found client email from criteria:", clientEmail);
        }
        
        // Log warning if no client email found
        if (!clientEmail) {
          console.warn("⚠️  No client email found for hotsheet. Token will have null client_email.");
        }
        
        const { data: tokenRow, error: tokenError } = await adminClient
          .from("share_tokens")
          .insert({
            token,
            agent_id: hotSheet.user_id,
            payload: {
              type: "client_hotsheet_invite",
              client_id: hotSheet.client_id || null,
              hot_sheet_id: hotSheet.id,
              client_email: clientEmail,
              client_first_name: clientFirstName,
              client_last_name: clientLastName,
              client_phone: clientPhone,
              suppress_initial_matches: true,
            },
            expires_at: null
          })
          .select()
          .single();

        if (tokenError) {
          console.error("❌ Error creating share token:", tokenError);
          throw new Error(`Failed to create share token: ${tokenError.message}`);
        }
        
        console.log("✅ Share token created successfully:", {
          token: tokenRow.token,
          payload: tokenRow.payload
        });

        const baseUrl = resolveEmailBaseUrl(Deno.env.get("EMAIL_BASE_URL"));
        const accessUrl = `${baseUrl}/client-hot-sheet/${token}`;
        
        // Render compact AAC listing cards (same as message notification emails)
        const listingsHtml = newListings
          .slice(0, 5)
          .map((listing: any) => renderHotSheetMatchListingEmailCard(listing, { baseUrl }))
          .join('');

        // Wrap with overflow note and CTA
        let fullListingsHtml = listingsHtml;
        
        if (newListings.length > 5) {
          fullListingsHtml += `
            <p style="color: #6b7280; margin: 16px 0;">
              And ${newListings.length - 5} more ${newListings.length - 5 === 1 ? 'property' : 'properties'}...
            </p>
          `;
        }
        
        // Add "View Hot Sheet" CTA
        fullListingsHtml += `
          <div style="margin-top: 32px; padding: 16px; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px;">
            <p style="margin: 0 0 12px 0; color: #1f2937;">View all properties and add comments:</p>
            <a href="${accessUrl}" 
              style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">
              View Hot Sheet
            </a>
          </div>
        `;

        // Get client name for the email
        let clientName = "Client";
        if (hotSheet.criteria?.clientFirstName && hotSheet.criteria?.clientLastName) {
          clientName = `${hotSheet.criteria.clientFirstName} ${hotSheet.criteria.clientLastName}`;
        } else if (hotSheetClients && hotSheetClients.length > 0 && hotSheetClients[0].clients) {
          const firstClientData = Array.isArray(hotSheetClients[0].clients) 
            ? hotSheetClients[0].clients[0] 
            : hotSheetClients[0].clients;
          if (firstClientData) {
            clientName = `${firstClientData.first_name} ${firstClientData.last_name}`;
          }
        }

        // Enqueue via email_jobs instead of direct Resend send
        const { error: emailJobError } = await adminClient.from("email_jobs").insert({
          payload: {
            provider: "resend",
            template: "hot-sheet-alert",
            to: recipients,
            subject: `${newListings.length} New Properties Match Your Search - ${hotSheet.name}`,
            variables: {
              userName: clientName,
              hotSheetName: hotSheet.name,
              matchCount: newListings.length,
              listingsHtml: fullListingsHtml,
            },
          },
        });

        if (emailJobError) {
          console.error("❌ Error enqueuing email job:", emailJobError);
          throw new Error(`Failed to enqueue email: ${emailJobError.message}`);
        }

        console.log("✅ Email job enqueued successfully");
        console.log("Recipients:", recipients);
        console.log("Listing count:", newListings.length);
        console.log("Hot sheet:", hotSheet.name);

        // ── Agent copy email (always sent) ────────────────────────────────
        // The agent explicitly initiated / sent this hot sheet, so they
        // always receive the copy of what their buyer received. This path
        // no longer consults notification_preferences.new_matches_enabled
        // (that flag is a Comms Center channel mute, not a hot-sheet gate).
        try {
          const { data: agentProfile2 } = await adminClient
            .from("agent_profiles")
            .select("email, first_name")
            .eq("id", hotSheet.user_id)
            .maybeSingle();

          const agentEmail = agentProfile2?.email?.toLowerCase().trim();

          if (agentEmail) {
            const buyerLabel = clientName || "your buyer";
            const agentCopyHtml = `
              <div style="margin: 0 0 16px 0; padding: 12px 16px; background-color: #f3f4f6; border-radius: 8px; color: #374151; font-size: 13px;">
                <strong>Copy of what your buyer received</strong><br>
                Sent to: ${buyerLabel}${recipients.length ? ` (${recipients.join(", ")})` : ""}<br>
                Hot Sheet: ${hotSheet.name}
              </div>
              ${fullListingsHtml}
            `;

            const { error: agentCopyError } = await adminClient.from("email_jobs").insert({
              idempotency_key: `hotsheet-agent-copy:${hotSheet.id}:${Date.now()}`,
              payload: {
                provider: "resend",
                template: "hot-sheet-alert",
                to: [agentEmail],
                subject: `Copy: Hot Sheet sent to ${buyerLabel}`,
                variables: {
                  userName: agentProfile2?.first_name || "there",
                  hotSheetName: hotSheet.name,
                  matchCount: newListings.length,
                  listingsHtml: agentCopyHtml,
                },
              },
            });

            if (agentCopyError) {
              console.warn("⚠️ Failed to enqueue agent copy email:", agentCopyError);
            } else {
              console.log("✅ Agent copy email enqueued for:", agentEmail);
            }
          } else {
            console.log("Skipping agent copy — notifications disabled or no agent email", {
              hasPrefs: !!agentPrefs,
              notificationsEnabled,
              hasAgentEmail: !!agentEmail,
            });
          }
        } catch (agentCopyErr) {
          console.warn("⚠️ Agent copy email failed (non-fatal):", agentCopyErr);
        }
      } else {
        console.log("No recipients configured - skipping email");
      }
    } else {
      console.log("Email send skipped based on notification settings");
    }

    // Mark listings as sent
    const sentRecords = newListings.map(listing => ({
      hot_sheet_id: hotSheetId,
      listing_id: listing.id,
      status_at_send: listing.status || 'active',
    }));

    if (sentRecords.length > 0) {
      await supabaseClient
        .from("hot_sheet_sent_listings")
        .insert(sentRecords);
    }

    // Update last_sent_at
    await supabaseClient
      .from("hot_sheets")
      .update({ last_sent_at: new Date().toISOString() })
      .eq("id", hotSheetId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        matchingCount: newListings.length,
        message: `Processed ${newListings.length} new ${newListings.length === 1 ? 'listing' : 'listings'}`
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error processing hot sheet:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
