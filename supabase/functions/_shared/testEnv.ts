/**
 * Deterministic environment control for tests.
 *
 * Pause switches (EMAIL_SENDING_PAUSED, HOT_SHEET_EMAILS_PAUSED,
 * COMMS_EMAILS_PAUSED) are read from the process environment at call time, so
 * any test that exercises a pause gate MUST pin every switch it depends on.
 * A test that passes or fails based on the ambient environment is not a test.
 */
export function withEnv<T>(vals: Record<string, string>, fn: () => T): T {
  const prev: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(vals)) {
    prev[k] = Deno.env.get(k);
    Deno.env.set(k, v);
  }
  try {
    return fn();
  } finally {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) Deno.env.delete(k);
      else Deno.env.set(k, v);
    }
  }
}

/** Every email pause switch explicitly OFF. */
export const ALL_PAUSES_OFF = {
  EMAIL_SENDING_PAUSED: "false",
  HOT_SHEET_EMAILS_PAUSED: "false",
  COMMS_EMAILS_PAUSED: "false",
} as const;

/** Every email pause switch explicitly ON. */
export const ALL_PAUSES_ON = {
  EMAIL_SENDING_PAUSED: "true",
  HOT_SHEET_EMAILS_PAUSED: "true",
  COMMS_EMAILS_PAUSED: "true",
} as const;
