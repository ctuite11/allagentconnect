import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import {
  getVerifiedAgentAudience,
  partitionAudience,
  type EligibleAgent,
} from "../_shared/verifiedAgentAudience.ts";
import { matchesCommunicationPreferences } from "../_shared/communicationPreferencesMatcher.ts";
import {
  countExistingReminders,
  reserveAndEnqueueMissingOpportunityReminder,
} from "../_shared/missingOpportunitiesEmail.ts";
import {
  defaultCommsActionUrl,
  insertDigestItems,
  loadCommsSchedules,
  partitionByCommsSchedule,
  type DigestItemInsert,
} from "../_shared/commsDigest.ts";
import {
  assertCommsEnqueueAllowed,
  isHotSheetSyncedClientNeed,
} from "../_shared/emailStreams.ts";
import { assertPrivilegedEmailProducerAuthority } from "../_shared/emailFunctionAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Payload {
  client_need_id: string;
  dry_run?: boolean;
  // Optional overrides — otherwise loaded from client_needs row
  state?: string;
  city?: string;
  property_type?: string;
  max_price?: number;
  bedrooms?: number;
  bathrooms?: number;
  description?: string;
}

const PROPERTY_TYPE_MAP: Record<string, string> = {
  single_family: "Single Family",
  condo: "Condo",
  townhouse: "Townhouse",
  multi_family: "Multi-Family",
  land: "Land",
  commercial: "Commercial",
  residential_rental: "Residential Rental",
  commercial_rental: "Commercial Rental",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await assertPrivilegedEmailProducerAuthority(req);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Pause gate before audience selection.
    const pauseGate = assertCommsEnqueueAllowed();
    if (pauseGate.paused) {
      return new Response(
        JSON.stringify({
          paused: true,
          switch: pauseGate.switch,
          reason: pauseGate.reason,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body: Payload = await req.json();
    if (!body?.client_need_id) {
      throw new Error("client_need_id is required");
    }
    const dryRun: boolean = body?.dry_run === true;

    // Load canonical event
    const { data: need, error: needErr } = await supabase
      .from("client_needs")
      .select("*")
      .eq("id", body.client_need_id)
      .single();
    if (needErr || !need) throw new Error(`client_need not found: ${needErr?.message}`);

    const state: string = body.state ?? need.state;
    const city: string = body.city ?? need.city;
    const propertyType: string = body.property_type ?? need.property_type;
    const maxPrice: number = Number(body.max_price ?? need.max_price ?? 0);
    const bedrooms = body.bedrooms ?? need.bedrooms ?? null;
    const bathrooms = body.bathrooms ?? need.bathrooms ?? null;
    const description = body.description ?? need.description ?? null;
    const senderId: string | null = need.submitted_by ?? null;

    // Isolation: Hot Sheet sync must not enter the Comms broadcast path.
    if (isHotSheetSyncedClientNeed(description)) {
      console.log(
        `[notify-agents-client-need] skip Hot-Sheet-synced client_need ${body.client_need_id}`,
      );
      return new Response(
        JSON.stringify({
          skipped: true,
          reason: "hot_sheet_synced_client_need",
          client_need_id: body.client_need_id,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Canonical audience
    const audience = await getVerifiedAgentAudience(supabase);

    // Independent-dimension matcher: uses each agent's saved Comms-Center
    // preferences (geo/price/property_type) against this event.
    const preferenceEvent = {
      state,
      city,
      price: maxPrice > 0 ? maxPrice : null,
      propertyTypes: propertyType ? [propertyType] : [],
    };

    // Explicit opt-out honored authoritatively
    const { data: optOutRows } = await supabase
      .from("agent_profiles")
      .select("id, receive_buyer_alerts")
      .in("id", audience.map((a) => a.agent_id));
    const optedOut = new Set<string>();
    for (const r of optOutRows || []) {
      if (r.receive_buyer_alerts === false) optedOut.add(r.id);
    }

    const partition = partitionAudience<EligibleAgent>(
      audience,
      (a) => matchesCommunicationPreferences(a.savedPrefs, preferenceEvent).matches,
      senderId,
      optedOut,
    );

    // Real-content dedup
    const realIds = partition.real.map((r) => r.agent_id);
    const { data: alreadySent } = realIds.length
      ? await supabase
          .from("agent_sent_client_needs")
          .select("agent_id")
          .eq("client_need_id", body.client_need_id)
          .in("agent_id", realIds)
      : { data: [] as any[] };
    const sentSet = new Set((alreadySent || []).map((r: any) => r.agent_id));
    const freshReal = partition.real.filter((r) => !sentSet.has(r.agent_id));

    // Reminder dedup pre-check
    const reminderIds = partition.reminder.map((a) => a.agent_id);
    const alreadyReminded = await countExistingReminders(
      supabase,
      "client_need",
      body.client_need_id,
      reminderIds,
    );
    const freshReminder = partition.reminder.filter((a) => !alreadyReminded.has(a.agent_id));

    const baseReport = {
      client_need_id: body.client_need_id,
      event_summary: {
        id: body.client_need_id,
        city, state,
        property_type: propertyType,
        max_price: maxPrice,
        bedrooms, bathrooms, description,
      },
      activated_verified_audience: audience.length,
      profile_complete: partition.counts.profile_complete,
      profile_incomplete: partition.counts.profile_incomplete,
      no_email: partition.counts.no_email,
      preferences_matched: partition.counts.preferences_matched,
      preferences_unset_fallback: partition.counts.preferences_unset_fallback,
      self_excluded: partition.counts.self_excluded,
      category_opted_out: partition.counts.category_opted_out,
      non_matching: partition.counts.non_matching,
      already_received_real: sentSet.size,
      reminder_already_recorded: alreadyReminded.size,
      final_real_recipients: freshReal.length,
      final_reminder_recipients: freshReminder.length,
    };

    if (dryRun) {
      console.log(
        `[notify-agents-client-need] DRY_RUN client_need=${body.client_need_id} audience=${audience.length} complete=${partition.counts.profile_complete} incomplete=${partition.counts.profile_incomplete} final_real=${freshReal.length} final_reminder=${freshReminder.length}`,
      );
      return new Response(
        JSON.stringify({ dry_run: true, ...baseReport }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Real-content enqueue
    if (freshReal.length === 0 && freshReminder.length === 0) {
      return new Response(
        JSON.stringify({ success: true, ...baseReport, real_enqueued: 0, reminder_enqueued: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const propertyTypeDisplay = PROPERTY_TYPE_MAP[propertyType] || propertyType;
    const priceFormatted = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(maxPrice);

    const itemHtml = `
            <h3 style="margin:0 0 8px;font-size:15px;color:#0f172a;">Client Need Details</h3>
            <ul style="margin:0;padding-left:18px;color:#334155;font-size:14px;line-height:1.5;">
              <li><strong>Location:</strong> ${city}, ${state}</li>
              <li><strong>Property Type:</strong> ${propertyTypeDisplay}</li>
              <li><strong>Maximum Budget:</strong> ${priceFormatted}</li>
              ${bedrooms ? `<li><strong>Bedrooms:</strong> ${bedrooms}</li>` : ""}
              ${bathrooms ? `<li><strong>Bathrooms:</strong> ${bathrooms}</li>` : ""}
              ${description ? `<li><strong>Description:</strong> ${description}</li>` : ""}
            </ul>`;

    // Timing preference: immediate → email_jobs; daily/weekly → digest queue only.
    const { schedules, muted } = await loadCommsSchedules(
      supabase,
      freshReal.map((a) => a.agent_id),
    );
    const { immediate, digest, skippedMuted } = partitionByCommsSchedule(
      freshReal,
      schedules,
      muted,
    );

    const emailJobs = immediate.map((a) => ({
      stream: "communications" as const,
      idempotency_key: `client-need:${body.client_need_id}:${a.agent_id}`,
      payload: {
        provider: "resend",
        template: "client-need-notification",
        to: a.email,
        subject: `New Client Need in ${city}, ${state}`,
        metadata: { audience: "agent", reason: a.reason, client_need_id: body.client_need_id },
        variables: {
          agentName: a.first_name || "Agent",
          city, state,
          propertyType: propertyTypeDisplay,
          maxPrice: priceFormatted,
          bedrooms, bathrooms, description,
          contentHtml: `
            ${itemHtml}
            <p style="margin:16px 0 0;">Log in to your dashboard to view more details and connect with this client.</p>
          `,
        },
      },
    }));

    let realEnqueued = 0;
    let digestEnqueued = 0;
    if (emailJobs.length) {
      const { error: insertError } = await supabase.from("email_jobs").insert(emailJobs);
      if (insertError) throw insertError;
      realEnqueued = emailJobs.length;
    }

    if (digest.length) {
      const digestRows: DigestItemInsert[] = digest.map((a) => ({
        agent_id: a.agent_id,
        cadence: a.cadence,
        source_type: "client_need",
        source_id: body.client_need_id,
        category: "Buyer Need",
        title: `New Client Need in ${city}, ${state}`,
        summary: {
          city,
          state,
          property_type: propertyTypeDisplay,
          max_price: priceFormatted,
          bedrooms,
          bathrooms,
          reason: a.reason,
        },
        item_html: itemHtml,
        action_url: defaultCommsActionUrl(),
      }));
      const dig = await insertDigestItems(supabase, digestRows);
      digestEnqueued = dig.inserted + dig.conflicted;
    }

    // Mark notified for immediate + digest recipients (not muted skips).
    const notified = [...immediate, ...digest];
    if (notified.length) {
      await supabase.from("agent_sent_client_needs").upsert(
        notified.map((r) => ({
          agent_id: r.agent_id,
          client_need_id: body.client_need_id,
          reason: r.reason,
        })),
        { onConflict: "agent_id,client_need_id" },
      );
    }
    void skippedMuted;

    // Reminder enqueue via reserve-first RPC.
    let reminderEnqueued = 0;
    let reminderConflict = 0;
    for (const a of partition.reminder) {
      const res = await reserveAndEnqueueMissingOpportunityReminder(supabase, {
        agent_id: a.agent_id,
        event_type: "client_need",
        event_id: body.client_need_id,
        email: a.email,
        firstName: a.first_name,
      });
      if (res.queued) reminderEnqueued++;
      else if (!res.reserved) reminderConflict++;
      else if (res.error) console.error("[notify-agents-client-need] reminder RPC error:", res.error);
    }

    console.log(
      `[notify-agents-client-need] client_need=${body.client_need_id} audience=${audience.length} real_enqueued=${realEnqueued} digest_enqueued=${digestEnqueued} reminder_enqueued=${reminderEnqueued}`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        ...baseReport,
        real_enqueued: realEnqueued,
        digest_enqueued: digestEnqueued,
        reminder_enqueued: reminderEnqueued,
        reminder_skipped_duplicate: reminderConflict,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("[notify-agents-client-need] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});