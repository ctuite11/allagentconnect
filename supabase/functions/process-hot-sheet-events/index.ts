import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { assertHotSheetEnqueueAllowed } from "../_shared/emailStreams.ts";
import {
  authorizeInternalServiceRole,
  serviceRoleInvokeHeaders,
} from "../_shared/internalServiceRoleAuth.ts";
import { runHotSheetOutboxWorker, type OutboxEvent } from "./worker.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Durable Hot Sheet outbox worker.
 *
 * Drains `hot_sheet_listing_events` under a lease and hands each event to the
 * canonical matcher. Every resulting email goes through
 * `enqueue_hot_sheet_delivery`, the same logical-claim boundary the legacy
 * pg_net path uses, so the two paths cannot double-deliver.
 *
 * Internal service-role callers only. Not scheduled.
 */
serve(async (req: Request): Promise<Response> => {
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
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Math.max(Number(body?.limit ?? 10) || 10, 1), 50);
    const leaseSeconds = Math.min(Math.max(Number(body?.lease_seconds ?? 300) || 300, 30), 900);
    const workerId = String(body?.worker_id ?? `phse-${crypto.randomUUID()}`);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const pauseGate = assertHotSheetEnqueueAllowed();

    if (pauseGate.paused) {
      console.log(`[process-hot-sheet-events] paused: ${pauseGate.switch}; claiming nothing`);
    }

    const result = await runHotSheetOutboxWorker({
      pauseGate,
      workerId,
      limit,
      leaseSeconds,
      claimEvents: async ({ limit, workerId, leaseSeconds }) => {
        const { data, error } = await supabase.rpc("claim_hot_sheet_events", {
          p_limit: limit,
          p_worker_id: workerId,
          p_lease_seconds: leaseSeconds,
        });
        if (error) return { events: [], error: error.message };
        return { events: (data ?? []) as OutboxEvent[] };
      },
      invokeMatcher: async (event) => {
        const { data, error } = await supabase.functions.invoke(
          "send-new-match-notification",
          {
            headers: serviceRoleInvokeHeaders(SUPABASE_SERVICE_ROLE_KEY),
            body: {
              trigger: "outbox",
              listing_id: event.listing_id,
              event_id: event.id,
            },
          },
        );
        return { data: data ?? null, error: error ?? null };
      },
      completeEvent: async (eventId, worker, state) => {
        const { data, error } = await supabase.rpc("complete_hot_sheet_event", {
          p_event_id: eventId,
          p_worker_id: worker,
          p_state: state,
        });
        if (error) {
          console.error("[process-hot-sheet-events] complete failed:", error.message);
          return false;
        }
        return Boolean(data);
      },
      failEvent: async (eventId, worker, message) => {
        const { data, error } = await supabase.rpc("fail_hot_sheet_event", {
          p_event_id: eventId,
          p_worker_id: worker,
          p_error: message,
        });
        if (error) {
          console.error("[process-hot-sheet-events] fail failed:", error.message);
          return false;
        }
        return Boolean(data);
      },
      logStage: async (eventId, listingId, stage, outcome, detail) => {
        await supabase.rpc("log_hot_sheet_event_stage", {
          p_event_id: eventId,
          p_listing_id: listingId,
          p_stage: stage,
          p_outcome: outcome,
          p_detail: detail,
        });
      },
    });

    return new Response(JSON.stringify(result.body), {
      status: result.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[process-hot-sheet-events] Error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
