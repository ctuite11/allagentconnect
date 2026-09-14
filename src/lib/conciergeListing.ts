import { supabase } from "@/integrations/supabase/client";

/**
 * Admin "Create Listing for Agent" (concierge) client helpers.
 *
 * All writes go through admin-only Edge Functions because normal listing
 * access intentionally only lets a member write their own listings — that
 * rule is not relaxed for this feature.
 *
 * Concierge listings are DRAFT ONLY. Nothing here can publish a listing;
 * the member publishes from their own account using the normal flow.
 */

export const CONCIERGE_BASE_PATH = "/admin/concierge-listings";

export interface ConciergeDraftSummary {
  id: string;
  agent_id: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  price: number | null;
  status: string;
  created_at: string;
  updated_at: string | null;
  created_by_user_id: string | null;
}

async function invoke<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) {
    let message = error.message;
    const context = (error as { context?: Response }).context;
    if (context && typeof context.text === "function") {
      try {
        const raw = await context.text();
        const parsed = JSON.parse(raw) as { error?: string };
        if (parsed?.error) message = parsed.error;
      } catch {
        /* keep original message */
      }
    }
    throw new Error(message);
  }
  const payload = data as { error?: string } | null;
  if (payload?.error) throw new Error(payload.error);
  return data as T;
}

export async function createConciergeDraft(
  agentId: string,
  listing: Record<string, unknown>,
): Promise<{ id: string }> {
  const res = await invoke<{ listing: { id: string } }>("admin-create-listing-for-agent", {
    agent_id: agentId,
    listing,
  });
  return res.listing;
}

export async function loadConciergeDraft(listingId: string): Promise<Record<string, any>> {
  const res = await invoke<{ listing: Record<string, any> }>("admin-manage-concierge-listing", {
    action: "load",
    listing_id: listingId,
  });
  return res.listing;
}

export async function updateConciergeDraft(
  listingId: string,
  listing: Record<string, unknown>,
): Promise<void> {
  await invoke("admin-manage-concierge-listing", {
    action: "update",
    listing_id: listingId,
    listing,
  });
}

export async function listConciergeDrafts(): Promise<ConciergeDraftSummary[]> {
  const res = await invoke<{ listings: ConciergeDraftSummary[] }>(
    "admin-manage-concierge-listing",
    { action: "list" },
  );
  return res.listings ?? [];
}
