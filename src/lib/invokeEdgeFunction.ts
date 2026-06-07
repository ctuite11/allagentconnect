import { supabase } from "@/integrations/supabase/client";

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
      throw new Error("Session expired. Please sign in again.");
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
    const context = (error as { context?: Response } | null)?.context;
    const backendError = context
      ? await context
          .clone()
          .json()
          .then((body) => (typeof body?.error === "string" ? body.error : null))
          .catch(() => null)
      : null;

    throw new Error(
      data?.error || backendError || error?.message || "Something went wrong. Please try again.",
    );
  }

  return data as T & { success: true };
}
