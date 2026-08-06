/**
 * Testable core of the listing-event → Hot Sheet matcher bridge.
 *
 * Pure of Deno.serve / Supabase client construction so the three behaviours
 * that matter can be asserted directly:
 *  - downstream success  → 200 with the matcher summary
 *  - downstream failure   → 500, no summary
 *  - paused               → 200, downstream never invoked
 */
export interface PauseGate {
  paused: boolean;
  reason?: string;
  switch?: string;
}

export interface MatcherInvocation {
  data?: unknown;
  error?: { message?: string } | null;
}

export interface FanoutResult {
  status: number;
  body: Record<string, unknown>;
}

export async function runListingFanout(params: {
  listingId: string;
  pauseGate: PauseGate;
  invokeMatcher: (listingId: string) => Promise<MatcherInvocation>;
}): Promise<FanoutResult> {
  const { listingId, pauseGate, invokeMatcher } = params;

  if (pauseGate.paused) {
    return {
      status: 200,
      body: {
        paused: true,
        switch: pauseGate.switch,
        reason: pauseGate.reason,
        hot_sheet_fanout: "skipped",
      },
    };
  }

  const { data, error } = await invokeMatcher(listingId);

  if (error) {
    return {
      status: 500,
      body: {
        success: false,
        hot_sheet_fanout: "failed",
        error: error.message ?? String(error),
      },
    };
  }

  return {
    status: 200,
    body: {
      success: true,
      hot_sheet_fanout: "invoked",
      matcher: data ?? null,
      legacy_client_needs_emails: "disabled_for_isolation",
    },
  };
}
