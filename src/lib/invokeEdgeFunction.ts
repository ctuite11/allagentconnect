import { supabase } from "@/integrations/supabase/client";

const GENERIC_INVOKE_ERRORS =
  /edge function returned a non-2xx status code|failed to send a request to the edge function/i;

function readErrorField(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  if (typeof record.error === "string" && record.error.trim()) return record.error.trim();
  if (typeof record.message === "string" && record.message.trim()) return record.message.trim();
  return null;
}

function friendlyEdgeFunctionMessage(raw: string, status?: number): string {
  const lower = raw.toLowerCase();

  if (
    status === 401 ||
    lower.includes("unauthorized") ||
    lower.includes("missing auth") ||
    lower.includes("invalid session") ||
    lower.includes("session expired")
  ) {
    return "Please sign in again.";
  }

  if (status === 403 || lower.includes("forbidden")) {
    return "You don't have permission to do that.";
  }

  if (
    lower.includes("recipientemail is required") ||
    lower.includes("recipient email is required") ||
    lower.includes("recipient email is missing")
  ) {
    return "Recipient email is missing.";
  }

  if (lower.includes("invalid recipient email")) {
    return "Recipient email is invalid.";
  }

  if (lower.includes("client not found")) {
    return "Contact not found.";
  }

  if (lower.includes("subject is required")) {
    return "Please enter a subject.";
  }

  if (lower.includes("message is required")) {
    return "Please enter a message.";
  }

  if (lower.includes("agent email not found")) {
    return "Your account is missing an email address. Update your profile and try again.";
  }

  return raw;
}

async function readResponseBody(response: Response): Promise<string | null> {
  try {
    const text = (await response.clone().text()).trim();
    if (!text) return null;

    try {
      const parsed = JSON.parse(text) as Record<string, unknown>;
      if (typeof parsed.error === "string" && parsed.error.trim()) return parsed.error.trim();
      if (typeof parsed.message === "string" && parsed.message.trim()) return parsed.message.trim();
    } catch {
      /* plain-text body */
    }

    return text.length <= 500 ? text : `${text.slice(0, 497)}…`;
  } catch {
    return null;
  }
}

/** Surfaces backend edge-function errors instead of generic SDK messages. */
export async function resolveEdgeFunctionErrorMessage(
  error: unknown,
  data?: unknown,
): Promise<string> {
  const fromData = readErrorField(data);
  if (fromData) return friendlyEdgeFunctionMessage(fromData);

  const err = error as { message?: string; context?: Response } | null;
  const response = err?.context instanceof Response ? err.context : null;
  const status = response?.status;

  if (response) {
    const fromBody = await readResponseBody(response);
    if (fromBody) return friendlyEdgeFunctionMessage(fromBody, status);
  }

  if (status === 401) return "Please sign in again.";
  if (status === 403) return "You don't have permission to do that.";

  const raw = err?.message?.trim();
  if (raw && !GENERIC_INVOKE_ERRORS.test(raw)) {
    return friendlyEdgeFunctionMessage(raw, status);
  }

  return "Something went wrong. Please try again.";
}

/**
 * Authenticated edge-function caller.
 * Ensures a valid session token is always sent and surfaces
 * the backend's own error string instead of the generic SDK message.
 */
export async function invokeEdgeFunction<T = Record<string, unknown>>(
  name: string,
  body: unknown,
): Promise<T & { success: true }> {
  // Always force a fresh access token before calling. A stale token causes
  // edge functions to reject with "Invalid session".
  let {
    data: { session },
  } = await supabase.auth.getSession();

  // Refresh if missing, or expiring within 60s.
  const expiresAt = session?.expires_at ?? 0;
  const nowSec = Math.floor(Date.now() / 1000);
  if (!session?.access_token || expiresAt - nowSec < 60) {
    const { data: refreshed, error: refreshError } =
      await supabase.auth.refreshSession();
    if (refreshError || !refreshed.session?.access_token) {
      throw new Error("Please sign in again.");
    }
    session = refreshed.session;
  }

  const token = session!.access_token;

  const { data, error } = await supabase.functions.invoke(name, {
    body,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (error || !data?.success) {
    const message = await resolveEdgeFunctionErrorMessage(error, data);
    console.error(`[invokeEdgeFunction:${name}]`, { error, data, message });
    throw new Error(message);
  }

  return data as T & { success: true };
}
