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
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;

  if (!token) {
    throw new Error("Session expired. Please sign in again.");
  }

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
