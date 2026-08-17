import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
import {
  getVerifiedAgentAudienceWithStats,
  partitionAudience,
  type EligibleAgent,
} from "../_shared/verifiedAgentAudience.ts";
import { matchesCommunicationPreferences } from "../_shared/communicationPreferencesMatcher.ts";
import { loadCommsOptIn, type CommsCategoryColumn } from "../_shared/commsOptIn.ts";
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
  buildDryRunRecipientRoster,
  cadenceCountsFromPartition,
  countOptInBlockReasons,
  finalTotalRecipients,
} from "../_shared/commsBroadcastDryRun.ts";
import { assertCommsEnqueueAllowed } from "../_shared/emailStreams.ts";
import {
  buildAttachmentCtaHtml,
  normalizeCommsAttachments,
} from "../_shared/commsBroadcastAttachments.ts";

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
  attachments?: Array<{
    path: string;
    kind: "image" | "video";
    mimeType?: string;
    name?: string;
    size?: number;
  }>;
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

    // 1. Canonical audience = Agent Network RPC, then delivery annotations.
    //    network_rpc_base is the raw RPC size before suppression drops.
    const { audience, network_rpc_base, globally_suppressed } =
      await getVerifiedAgentAudienceWithStats(supabase);
    const audienceIds = audience.map((a) => a.agent_id);

    // 2. Legacy category-column false set (still collected for counts).
    //    Authoritative mute is loadCommsOptIn below: missing preference row,
    //    either master switch off, or category channel off ⇒ blocked.
    const CATEGORY_COLUMN: Record<Category, "buyer_need" | "renter_need" | "sales_intel" | "general_discussion"> = {
      buyer_need: "buyer_need",
      renter_need: "renter_need",
      sales_intel: "sales_intel",
      general_discussion: "general_discussion",
    };
    const categoryColumn = CATEGORY_COLUMN[category];
    const optedOut = new Set<string>();
    if (audienceIds.length) {
      const { data: prefRows, error: prefErr } = await supabase
        .from("notification_preferences")
        .select(`user_id, ${categoryColumn}`)
        .in("user_id", audienceIds);
      if (prefErr) {
        console.error("[send-client-need-notification] notification_preferences lookup failed:", prefErr);
      }
      for (const r of (prefRows ?? []) as any[]) {
        if (r?.[categoryColumn] === false) optedOut.add(r.user_id);
      }
    }

    // Canonical Comms Center opt-in gate (Aug 2026 policy). Missing row,
    // master switch off, or category channel off ⇒ muted. Agents inside the
    // allowed set with no narrowing dimensions are an explicit broad opt-in
    // for the enabled category (not a missing-row fallback).
    const commsOptIn = await loadCommsOptIn(
      supabase,
      audienceIds,
      categoryColumn as CommsCategoryColumn,
    );

    // 3. Preference match via shared independent-dimension matcher.
    //    Semantics:
    //      - audience_scope="network_wide": every preferences-set agent
    //        matches (auto-pass regardless of dimensions).
    //      - audience_scope="targeted" + no criteria: match set is empty
    //        for preferences-set agents; explicitly opted-in agents with no
    //        narrowing dimensions still receive (explicit broad opt-in).
    //      - audience_scope="targeted" + criteria: expand the broadcast
    //        criteria into one or more per-location events and pass if
    //        the agent's saved prefs accept at least one.
    //    Missing preference rows never reach this stage — they are blocked
    //    by loadCommsOptIn.
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
      commsOptIn.allowed,
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
      const { schedules, muted } = await loadCommsSchedules(
        supabase,
        partition.real.map((r) => r.agent_id),
      );
      const { immediate, digest, skippedMuted } = partitionByCommsSchedule(
        partition.real,
        schedules,
        muted,
      );
      const recipients = buildDryRunRecipientRoster(immediate, digest);
      const cadence_counts = cadenceCountsFromPartition(
        immediate.length,
        digest,
        skippedMuted,
      );
      const optInBlocked = countOptInBlockReasons(commsOptIn.blocked);
      const final_total_recipients = finalTotalRecipients(cadence_counts);

      return new Response(
        JSON.stringify({
          dry_run: true,
          category,
          subject,
          audience_scope: audienceScope,
          parsed_criteria: parsedCriteria,
          any_criteria_supplied: anyCriteriaSupplied,
          // Raw Agent Network RPC size BEFORE email-suppression drops.
          network_rpc_base,
          globally_suppressed,
          // Post-suppression audience used for preference / opt-in matching.
          activated_verified_audience: audience.length,
          profile_complete: partition.counts.profile_complete,
          profile_incomplete: partition.counts.profile_incomplete,
          no_email: partition.counts.no_email,
          preferences_matched: partition.counts.preferences_matched,
          // Explicitly opted-in agents with no narrowing criteria.
          // Missing preference rows are blocked — never counted here.
          explicit_broad_opt_in: partition.counts.preferences_unset_fallback,
          self_excluded: partition.counts.self_excluded,
          category_opted_out: partition.counts.category_opted_out,
          non_matching: partition.counts.non_matching,
          opt_in_blocked: {
            missing_row: optInBlocked.missing_row,
            client_needs_disabled: optInBlocked.client_needs_disabled,
            new_matches_disabled: optInBlocked.new_matches_disabled,
            category_off: optInBlocked.category_off,
            lookup_error: optInBlocked.lookup_error,
          },
          cadence_counts: {
            immediate: cadence_counts.immediate,
            daily: cadence_counts.daily,
            weekly: cadence_counts.weekly,
            skipped_muted: cadence_counts.skipped_muted,
          },
          already_received_real: 0,
          reminder_already_recorded: 0,
          final_real_recipients: partition.real.length,
          final_total_recipients,
          final_reminder_recipients: partition.reminder.length,
          recipients: recipients.map((r) => ({
            user_id: r.user_id,
            name: r.name,
            email: r.email,
            cadence: r.cadence,
            matching_reason: r.matching_reason,
          })),
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

    // 5b. Attachments (photos/video). Purely additive: failures here never
    //     affect audience, email eligibility, or delivery mechanics.
    const normalizedAttachments = normalizeCommsAttachments(body?.attachments, user.id);
    if (!normalizedAttachments.ok) {
      return new Response(
        JSON.stringify({ error: normalizedAttachments.error, success: false }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const attachments = normalizedAttachments.attachments;
    if (attachments.length > 0) {
      const { error: attachError } = await supabase
        .from("comms_broadcast_attachments")
        .insert(
          attachments.map((a) => ({
            broadcast_id: broadcastId,
            sender_id: user.id,
            path: a.path,
            kind: a.kind,
            mime_type: a.mime_type,
            file_name: a.file_name,
            size_bytes: a.size_bytes,
            sort_order: a.sort_order,
          })),
        );
      if (attachError) {
        console.error("[send-client-need-notification] attachment persist failed:", attachError);
      }
    }

    // Producer-side pause gate. The in-app broadcast above is preserved (the
    // feed keeps working), but NOTHING downstream may be written: no
    // email_jobs, no digest items, no agent_sent_broadcasts dedup rows that
    // would falsely claim delivery.
    const commsPause = assertCommsEnqueueAllowed();
    if (commsPause.paused) {
      console.log(
        `[send-client-need-notification] email fan-out skipped (${commsPause.switch}) broadcast=${broadcastId}`,
      );
      return new Response(
        JSON.stringify({
          success: true,
          broadcast_id: broadcastId,
          email_fanout_skipped: true,
          paused: true,
          reason: commsPause.reason,
          switch: commsPause.switch,
          sent: 0,
          queued: 0,
          digest_enqueued: 0,
          recipientCount: 0,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

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

    const itemHtml = `
            <h2 style="margin:0 0 8px;font-size:16px;color:#0f172a;">${subject}</h2>
            <p style="margin:0 0 8px;font-size:14px;color:#334155;"><strong>From:</strong> ${senderName}${senderCompany ? ` (${senderCompany})` : ""}</p>
            <p style="margin:0 0 12px;font-size:14px;color:#334155;"><strong>Category:</strong> ${categoryLabel}</p>
            ${criteriaText ? `<div style="background:#ffffff;border:1px solid #e5e7eb;padding:16px;border-radius:8px;margin:12px 0;"><h3 style="margin:0 0 8px;font-size:14px;">Request Criteria</h3>${criteriaText}</div>` : ""}
            <div style="background:#ffffff;border:1px solid #e5e7eb;padding:16px;border-radius:8px;">
              <p style="white-space: pre-wrap;margin:0;font-size:14px;color:#334155;">${message}</p>
            </div>${buildAttachmentCtaHtml(attachments, senderName, defaultCommsActionUrl())}`;

    const { schedules, muted } = await loadCommsSchedules(
      supabase,
      fresh.map((r) => r.agent_id),
    );
    const { immediate, digest, skippedMuted } = partitionByCommsSchedule(
      fresh,
      schedules,
      muted,
    );

    const emailJobs: any[] = immediate.map((r) => ({
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
          contentHtml: itemHtml,
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
              ${itemHtml}
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

    let digestEnqueued = 0;
    if (digest.length) {
      const digestRows: DigestItemInsert[] = digest.map((r) => ({
        agent_id: r.agent_id,
        cadence: r.cadence,
        source_type: "broadcast",
        source_id: broadcastId,
        category: categoryLabel,
        title: subject,
        summary: {
          category,
          category_label: categoryLabel,
          sender_name: senderName,
          sender_company: senderCompany,
          reason: r.reason,
        },
        item_html: itemHtml,
        action_url: defaultCommsActionUrl(),
      }));
      const dig = await insertDigestItems(supabase, digestRows);
      digestEnqueued = dig.inserted + dig.conflicted;
    }

    const notified = [...immediate, ...digest];
    if (notified.length > 0) {
      await supabase.from("agent_sent_broadcasts").upsert(
        notified.map((r) => ({
          agent_id: r.agent_id,
          broadcast_id: broadcastId,
          reason: r.reason,
        })),
        { onConflict: "agent_id,broadcast_id" },
      );
    }
    void skippedMuted;

    // Finalize recipient_count after timing partition (muted agents excluded).
    if (notified.length !== partition.real.length) {
      await supabase
        .from("comms_broadcasts")
        .update({ recipient_count: notified.length })
        .eq("id", broadcastId);
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

    const matched = notified.filter((r) => r.reason === "preferences_match").length;
    const fallback = notified.filter((r) => r.reason === "preferences_unset").length;

    console.log(
      `[send-client-need-notification] broadcast=${broadcastId} audience=${audience.length} matched=${matched} fallback=${fallback} immediate=${immediate.length} digest=${digestEnqueued} sender_excluded=1 opted_out=${optedOut.size} duplicates_skipped=${partition.real.length - fresh.length} reminder_enqueued=${reminderEnqueued}`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: `Message delivered to ${notified.length} agents (${immediate.length} immediate, ${digestEnqueued} digest)`,
        sent: notified.length,
        immediate_enqueued: immediate.length,
        digest_enqueued: digestEnqueued,
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