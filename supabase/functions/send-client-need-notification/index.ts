import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
import {
  getVerifiedAgentAudienceWithStats,
  partitionAudience,
  type EligibleAgent,
} from "../_shared/verifiedAgentAudience.ts";
import { matchesCommunicationPreferences } from "../_shared/communicationPreferencesMatcher.ts";
import {
  countExistingReminders,
  reserveAndEnqueueMissingOpportunityReminder,
} from "../_shared/missingOpportunitiesEmail.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Category = "buyer_need" | "renter_need" | "sales_intel" | "general_discussion";

interface SendNotificationRequest {
  category: Category;
  subject: string;
  message: string;
  previewOnly?: boolean;
  dry_run?: boolean;
  sendCopyToSelf?: boolean;
  audience_scope?: "targeted" | "network_wide";
  criteria?: {
    state?: string;
    counties?: string[];
    cities?: string[];
    neighborhoods?: string[];
    minPrice?: number;
    maxPrice?: number;
    propertyTypes?: string[];
  };
}

const isValidEmail = (email: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const CATEGORY_LABEL: Record<Category, string> = {
  buyer_need: "Buyer Need",
  renter_need: "Renter Need",
  sales_intel: "Sales Intel",
  general_discussion: "General Discussion",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: SendNotificationRequest = await req.json();
    const dryRunEarly: boolean = body?.dry_run === true;

    // Auth resolution. Both dry runs and live sends require a valid
    // authenticated session — there is no alternate authorization path.
    const authHeader = req.headers.get("Authorization");
    let user: { id: string; email?: string | null } | null = null;
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data, error } = await supabase.auth.getUser(token);
      if (!error && data?.user) user = { id: data.user.id, email: data.user.email };
    }
    if (!user) throw new Error("Unauthorized");

    const { category, subject, message, criteria, previewOnly, sendCopyToSelf } = body;
    const dryRun = dryRunEarly;
    // Default to "targeted"; anything other than the literal "network_wide"
    // is normalized back to "targeted" so no-criteria never silently
    // becomes a network-wide broadcast.
    const audienceScope: "targeted" | "network_wide" =
      body?.audience_scope === "network_wide" ? "network_wide" : "targeted";

    // Normalize criteria into a parsed_criteria object usable for matching
    // and for the dry-run response contract.
    const normStr = (v: unknown) =>
      typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
    const normStrArr = (v: unknown) =>
      Array.isArray(v)
        ? Array.from(new Set(v.filter((x) => typeof x === "string" && x.trim().length > 0).map((x: string) => x.trim())))
        : [];
    const normNum = (v: unknown) =>
      typeof v === "number" && Number.isFinite(v) ? v : null;
    const parsedCriteria = {
      state: normStr(criteria?.state),
      counties: normStrArr(criteria?.counties),
      cities: normStrArr(criteria?.cities),
      neighborhoods: normStrArr(criteria?.neighborhoods),
      min_price: normNum(criteria?.minPrice),
      max_price: normNum(criteria?.maxPrice),
      property_types: normStrArr(criteria?.propertyTypes),
    };
    const anyCriteriaSupplied =
      !!parsedCriteria.state ||
      parsedCriteria.counties.length > 0 ||
      parsedCriteria.cities.length > 0 ||
      parsedCriteria.neighborhoods.length > 0 ||
      parsedCriteria.min_price != null ||
      parsedCriteria.max_price != null ||
      parsedCriteria.property_types.length > 0;

    // Sender profile (for headers / self-copy)
    const { data: senderProfile } = await supabase
      .from("agent_profiles")
      .select("first_name, last_name, email, company")
      .eq("id", user.id)
      .single();
    const senderName = senderProfile
      ? `${senderProfile.first_name} ${senderProfile.last_name}`
      : "An Agent";
    const senderEmail = senderProfile?.email || user.email;
    const senderCompany = senderProfile?.company || "";
    const validReplyTo = senderEmail && isValidEmail(senderEmail) ? senderEmail : undefined;

    // 1. Canonical audience of verified, profile-eligible agents
    //    (globally unsubscribed / suppressed excluded — count is surfaced).
    const { audience, globally_suppressed } =
      await getVerifiedAgentAudienceWithStats(supabase);
    const audienceIds = audience.map((a) => a.agent_id);

    // 2. Category-level opt-out lookup (buyer_need / renter_need / sales_intel /
    //    general_discussion). Preference matching itself is delegated to the
    //    shared independent-dimension matcher via each agent's savedPrefs.
    const { data: prefs } = await supabase
      .from("notification_preferences")
      .select(`user_id, ${category}`)
      .in("user_id", audienceIds);
    const optedOut = new Set<string>();
    for (const p of (prefs || []) as any[]) {
      if (p[category] === false) optedOut.add(p.user_id);
    }

    // 3. Preference match via shared independent-dimension matcher.
    //    Semantics:
    //      - audience_scope="network_wide": every preferences-set agent
    //        matches (auto-pass regardless of dimensions).
    //      - audience_scope="targeted" + no criteria: match set is empty
    //        for preferences-set agents; preferences-unset agents still
    //        receive via partitionAudience fallback.
    //      - audience_scope="targeted" + criteria: expand the broadcast
    //        criteria into one or more per-location events and pass if
    //        the agent's saved prefs accept at least one.
    const broadcastEvents: Array<Record<string, unknown>> = [];
    if (audienceScope !== "network_wide" && anyCriteriaSupplied) {
      const basePrice = {
        minPrice: parsedCriteria.min_price ?? null,
        maxPrice: parsedCriteria.max_price ?? null,
        propertyTypes: parsedCriteria.property_types,
      };
      const cities = parsedCriteria.cities;
      const counties = parsedCriteria.counties;
      const hoods = parsedCriteria.neighborhoods;
      // Emit one event per city / county / neighborhood so location OR
      // semantics hold across dimensions. If only a state was supplied,
      // emit a single state-level event.
      const geoEvents: Array<Record<string, unknown>> = [];
      for (const c of cities) geoEvents.push({ state: parsedCriteria.state, city: c });
      for (const c of counties) geoEvents.push({ state: parsedCriteria.state, county: c });
      for (const n of hoods) geoEvents.push({ state: parsedCriteria.state, neighborhood: n });
      if (!geoEvents.length) {
        geoEvents.push({ state: parsedCriteria.state ?? null });
      }
      for (const g of geoEvents) broadcastEvents.push({ ...g, ...basePrice });
    }
    const matchFn = (a: EligibleAgent): boolean => {
      if (audienceScope === "network_wide") return true;
      if (!anyCriteriaSupplied) return false;
      return broadcastEvents.some(
        (ev) => matchesCommunicationPreferences(a.savedPrefs, ev as any).matches,
      );
    };

    const partition = partitionAudience<EligibleAgent>(
      audience,
      matchFn,
      user.id,
      optedOut,
    );

    // 4. Preview short-circuit (no persistence, no send)
    if (previewOnly) {
      const { data: profiles } = await supabase
        .from("agent_profiles")
        .select("id, email, first_name, last_name, phone, company")
        .in("id", partition.real.map((r) => r.agent_id));
      const list = (profiles || []).map((a: any) => ({
        id: a.id,
        name: `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim() || "AAC Agent",
        brokerage: a.company ?? null,
        phone: a.phone ?? null,
        email: a.email ?? null,
      }));
      return new Response(
        JSON.stringify({
          success: true,
          recipientCount: list.length,
          matched: partition.counts.preferences_matched,
          fallback: partition.counts.preferences_unset_fallback,
          opted_out: optedOut.size,
          audience: audience.length,
          profile_incomplete: partition.counts.profile_incomplete,
          recipients: list,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Dry-run: zero writes (no broadcast row, no email_jobs, no dedup).
    if (dryRun) {
      const reminderIdsDry = partition.reminder.map((a) => a.agent_id);
      return new Response(
        JSON.stringify({
          dry_run: true,
          category,
          subject,
          audience_scope: audienceScope,
          parsed_criteria: parsedCriteria,
          any_criteria_supplied: anyCriteriaSupplied,
          activated_verified_audience: audience.length,
          profile_complete: partition.counts.profile_complete,
          profile_incomplete: partition.counts.profile_incomplete,
          no_email: partition.counts.no_email,
          preferences_matched: partition.counts.preferences_matched,
          preferences_unset_fallback: partition.counts.preferences_unset_fallback,
          self_excluded: partition.counts.self_excluded,
          category_opted_out: partition.counts.category_opted_out,
          globally_suppressed,
          non_matching: partition.counts.non_matching,
          already_received_real: 0,
          reminder_already_recorded: 0,
          final_real_recipients: partition.real.length,
          final_reminder_recipients: reminderIdsDry.length,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 5. Persist broadcast first so we have a canonical id for dedup + metadata.
    //    recipient_count is finalized to the post-dedup real-content count
    //    (`fresh.length`) after step 6. Insert with the pre-dedup real count
    //    as a provisional value so we have a valid broadcastId for dedup lookup.
    const { data: broadcast, error: broadcastError } = await supabase
      .from("comms_broadcasts")
      .insert({
        sender_id: user.id,
        category,
        subject,
        message,
        criteria: criteria ?? null,
        recipient_count: partition.real.length,
      })
      .select("id")
      .single();
    if (broadcastError || !broadcast) {
      console.error("[send-client-need-notification] broadcast persist failed:", broadcastError);
      throw new Error("Failed to persist broadcast");
    }
    const broadcastId = broadcast.id as string;

    // 6. Durable dedup against agent_sent_broadcasts
    const realIds = partition.real.map((r) => r.agent_id);
    const { data: alreadySent } = realIds.length
      ? await supabase
          .from("agent_sent_broadcasts")
          .select("agent_id")
          .eq("broadcast_id", broadcastId)
          .in("agent_id", realIds)
      : { data: [] as any[] };
    const sentSet = new Set((alreadySent || []).map((r: any) => r.agent_id));
    const fresh = partition.real.filter((r) => !sentSet.has(r.agent_id));

    // Finalize recipient_count = post-dedup real-content recipients only.
    // `fresh` is strictly real-content; reminder recipients live on
    // `partition.reminder` and are never counted here.
    if (fresh.length !== partition.real.length) {
      await supabase
        .from("comms_broadcasts")
        .update({ recipient_count: fresh.length })
        .eq("id", broadcastId);
    }

    // 7. Compose and enqueue
    let criteriaText = "";
    if (criteria) {
      if (criteria.state) criteriaText += `<strong>State:</strong> ${criteria.state}<br>`;
      if (criteria.propertyTypes?.length)
        criteriaText += `<strong>Property Types:</strong> ${criteria.propertyTypes.join(", ")}<br>`;
      if (criteria.minPrice)
        criteriaText += `<strong>Min Price:</strong> $${criteria.minPrice.toLocaleString()}<br>`;
      if (criteria.maxPrice)
        criteriaText += `<strong>Max Price:</strong> $${criteria.maxPrice.toLocaleString()}<br>`;
    }

    const categoryLabel = CATEGORY_LABEL[category];

    const emailJobs: any[] = fresh.map((r) => ({
      idempotency_key: `client-need-broadcast:${broadcastId}:${r.agent_id}`,
      payload: {
        provider: "resend",
        template: "client-need-broadcast",
        to: r.email,
        subject: `[${categoryLabel}] ${subject}`,
        reply_to: validReplyTo,
        metadata: { audience: "agent", reason: r.reason, broadcast_id: broadcastId, category },
        variables: {
          agentName: r.first_name,
          senderName,
          senderCompany,
          category: categoryLabel,
          subject,
          message,
          criteriaText,
          contentHtml: `
            <h2>${subject}</h2>
            <p><strong>From:</strong> ${senderName}${senderCompany ? ` (${senderCompany})` : ""}</p>
            <p><strong>Category:</strong> ${categoryLabel}</p>
            ${criteriaText ? `<div style="background:#ffffff;border:1px solid #e5e7eb;padding:16px;border-radius:8px;margin:20px 0;"><h3>Request Criteria</h3>${criteriaText}</div>` : ""}
            <div style="background:#ffffff;border:1px solid #e5e7eb;padding:16px;border-radius:8px;">
              <p style="white-space: pre-wrap;">${message}</p>
            </div>
          `,
        },
      },
    }));

    if (sendCopyToSelf && senderEmail && isValidEmail(senderEmail)) {
      emailJobs.push({
        payload: {
          provider: "resend",
          template: "client-need-broadcast",
          to: senderEmail,
          subject: `[COPY] [${categoryLabel}] ${subject}`,
          metadata: { audience: "sender_copy", broadcast_id: broadcastId, category },
          variables: {
            agentName: senderName,
            senderName,
            senderCompany,
            category: categoryLabel,
            subject,
            message,
            criteriaText,
            isCopy: true,
            recipientCount: fresh.length,
            contentHtml: `
              <div style="background: #ffffff; border: 1px solid #e5e7eb; padding: 12px; border-radius: 6px; margin-bottom: 20px;">
                <p><strong>Copy of email sent to ${fresh.length} recipients</strong></p>
              </div>
              <h2>${subject}</h2>
              <p><strong>Category:</strong> ${categoryLabel}</p>
              ${criteriaText ? `<div style="background:#ffffff;border:1px solid #e5e7eb;padding:16px;border-radius:8px;margin:20px 0;">${criteriaText}</div>` : ""}
              <div style="background:#ffffff;border:1px solid #e5e7eb;padding:16px;border-radius:8px;"><p style="white-space: pre-wrap;">${message}</p></div>
            `,
          },
        },
      });
    }

    if (emailJobs.length > 0) {
      const { error: insertError } = await supabase.from("email_jobs").insert(emailJobs);
      if (insertError) {
        console.error("[send-client-need-notification] enqueue failed:", insertError);
        throw new Error("Failed to queue emails");
      }
    }

    if (fresh.length > 0) {
      await supabase.from("agent_sent_broadcasts").upsert(
        fresh.map((r) => ({
          agent_id: r.agent_id,
          broadcast_id: broadcastId,
          reason: r.reason,
        })),
        { onConflict: "agent_id,broadcast_id" },
      );
    }

    // Reminder enqueue via reserve-first RPC.
    let reminderEnqueued = 0;
    let reminderConflict = 0;
    for (const a of partition.reminder) {
      const res = await reserveAndEnqueueMissingOpportunityReminder(supabase, {
        agent_id: a.agent_id,
        event_type: "broadcast",
        event_id: broadcastId,
        email: a.email,
        firstName: a.first_name,
      });
      if (res.queued) reminderEnqueued++;
      else if (!res.reserved) reminderConflict++;
      else if (res.error) console.error("[send-client-need-notification] reminder RPC error:", res.error);
    }

    const matched = fresh.filter((r) => r.reason === "preferences_match").length;
    const fallback = fresh.filter((r) => r.reason === "preferences_unset").length;

    console.log(
      `[send-client-need-notification] broadcast=${broadcastId} audience=${audience.length} matched=${matched} fallback=${fallback} sender_excluded=1 opted_out=${optedOut.size} duplicates_skipped=${partition.real.length - fresh.length} reminder_enqueued=${reminderEnqueued}`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: `Message sent to ${fresh.length} agents`,
        sent: fresh.length,
        matched,
        fallback,
        opted_out: optedOut.size,
        duplicates_skipped: partition.real.length - fresh.length,
        audience: audience.length,
        broadcast_id: broadcastId,
        profile_incomplete: partition.counts.profile_incomplete,
        reminder_enqueued: reminderEnqueued,
        reminder_skipped_duplicate: reminderConflict,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("[send-client-need-notification] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message, success: false }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
};

serve(handler);