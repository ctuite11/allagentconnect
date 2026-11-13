/**
 * Request Access form — decides what the agent sees after a submission attempt.
 *
 * Rules (Chris, 2026-11-13):
 * - Never block on the browser's own "offline" signal; always try to send.
 * - Show the "received" confirmation ONLY when the server confirms it
 *   (`submitted` or `already_pending`).
 * - Any failure (no connection, timeout, server error) is a clear, retryable
 *   error. The form keeps the agent's details; resubmitting is safe because the
 *   server de-duplicates open requests by email.
 */

export type RequestAccessOutcome =
  | { kind: "received"; alreadyOnFile: boolean; message: string }
  | { kind: "account_exists"; message: string }
  | { kind: "turnstile_failed"; message: string }
  | { kind: "error"; message: string };

export type RequestAccessFailure = "network" | "timeout" | "server";

export const RECEIVED_MESSAGE =
  "Request received. We'll email you when your license is verified.";
export const ALREADY_ON_FILE_MESSAGE =
  "We already have your request on file. We'll be in touch shortly.";

export const RETRY_MESSAGES: Record<RequestAccessFailure, string> = {
  network:
    "We couldn't reach All Agent Connect. Please check your connection and tap Request Access again. Your details are still filled in.",
  timeout:
    "We couldn't confirm your request was received. Please tap Request Access again. Your details are still filled in, and you won't be submitted twice.",
  server:
    "Something went wrong on our end. Please tap Request Access again in a moment. Your details are still filled in.",
};

type ResponseBody = {
  code?: unknown;
  message?: unknown;
  error?: unknown;
  errors?: unknown;
};

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

/** Interpret a response body the server actually returned (any HTTP status). */
export function interpretRequestAccessResponse(body: unknown): RequestAccessOutcome {
  const b = (body && typeof body === "object" ? body : {}) as ResponseBody;
  const firstError = Array.isArray(b.errors) ? str(b.errors[0]) : undefined;

  switch (b.code) {
    case "submitted":
      return { kind: "received", alreadyOnFile: false, message: RECEIVED_MESSAGE };
    case "already_pending":
      return {
        kind: "received",
        alreadyOnFile: true,
        message: str(b.message) ?? ALREADY_ON_FILE_MESSAGE,
      };
    case "account_exists":
      return {
        kind: "account_exists",
        message: "An account with this email already exists. Please sign in.",
      };
    case "turnstile_failed":
      return {
        kind: "turnstile_failed",
        message: str(b.error) ?? "Verification failed. Please refresh and try again.",
      };
    case "validation_failed":
    case "invalid_email":
      return {
        kind: "error",
        message: firstError ?? str(b.error) ?? "Please review your submission.",
      };
    default:
      return { kind: "error", message: RETRY_MESSAGES.server };
  }
}

/** A submission attempt that produced no usable server confirmation. */
export function requestAccessFailure(reason: RequestAccessFailure): RequestAccessOutcome {
  return { kind: "error", message: RETRY_MESSAGES[reason] };
}
