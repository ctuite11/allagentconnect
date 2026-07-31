/**
 * Dual-pause gate: environment + database email_control_state.
 * Missing configuration fails closed.
 */

import type { EmailStream } from "./emailStreams.ts";
import {
  getClaimableStreams as getEnvClaimableStreams,
  isGlobalEmailPaused,
} from "./emailStreams.ts";

export type EmailControlState = {
  ground_zero_at: string;
  global_paused: boolean;
  hot_sheet_paused: boolean;
  communications_paused: boolean;
  transactional_paused: boolean;
  system_paused: boolean;
  last_auto_shutdown_reason?: string | null;
  last_auto_shutdown_at?: string | null;
  last_auto_shutdown_source_event?: string | null;
};

export type DualPauseResult =
  | { paused: false; control: EmailControlState; claimableStreams: EmailStream[] }
  | {
    paused: true;
    reason: string;
    switch: string;
    control?: EmailControlState | null;
    claimableStreams: EmailStream[];
  };

type RpcClient = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message?: string } | null }>;
};

export async function loadEmailControlState(
  supabase: RpcClient,
): Promise<EmailControlState | null> {
  const { data, error } = await supabase.rpc("email_control_get");
  if (error || !data) return null;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  if (typeof r.global_paused !== "boolean") return null;
  return {
    ground_zero_at: String(r.ground_zero_at ?? ""),
    global_paused: r.global_paused,
    hot_sheet_paused: Boolean(r.hot_sheet_paused),
    communications_paused: Boolean(r.communications_paused),
    transactional_paused: Boolean(r.transactional_paused),
    system_paused: Boolean(r.system_paused),
    last_auto_shutdown_reason:
      typeof r.last_auto_shutdown_reason === "string"
        ? r.last_auto_shutdown_reason
        : null,
    last_auto_shutdown_at:
      typeof r.last_auto_shutdown_at === "string" ? r.last_auto_shutdown_at : null,
    last_auto_shutdown_source_event:
      typeof r.last_auto_shutdown_source_event === "string"
        ? r.last_auto_shutdown_source_event
        : null,
  };
}

function dbStreamPaused(control: EmailControlState, stream: EmailStream): boolean {
  if (control.global_paused) return true;
  if (stream === "hot_sheet") return control.hot_sheet_paused;
  if (stream === "communications") return control.communications_paused;
  if (stream === "transactional") return control.transactional_paused;
  if (stream === "system") return control.system_paused;
  return true;
}

/**
 * Worker may claim only when BOTH:
 *   EMAIL_SENDING_PAUSED=false (env fail-closed)
 *   database global_paused=false
 * Stream pauses from env and DB are intersected.
 */
export async function assertWorkerSendAllowed(
  supabase: RpcClient,
): Promise<DualPauseResult> {
  if (isGlobalEmailPaused()) {
    return {
      paused: true,
      reason: "Global email sending is paused (environment)",
      switch: "EMAIL_SENDING_PAUSED",
      claimableStreams: [],
    };
  }

  const control = await loadEmailControlState(supabase);
  if (!control) {
    return {
      paused: true,
      reason: "email_control_state missing or unreadable (fail closed)",
      switch: "email_control_state",
      control: null,
      claimableStreams: [],
    };
  }

  if (control.global_paused) {
    return {
      paused: true,
      reason: "Global email sending is paused (database)",
      switch: "email_control_state.global_paused",
      control,
      claimableStreams: [],
    };
  }

  const envStreams = getEnvClaimableStreams();
  const claimableStreams = envStreams.filter((s) => !dbStreamPaused(control, s));

  if (claimableStreams.length === 0) {
    return {
      paused: true,
      reason: "No claimable streams after env+database pause intersection",
      switch: "stream_pauses",
      control,
      claimableStreams: [],
    };
  }

  return { paused: false, control, claimableStreams };
}

export const EMAIL_CLAIM_MAX = 5;
