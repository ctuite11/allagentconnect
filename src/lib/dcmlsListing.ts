import { supabase } from "@/integrations/supabase/client";
import type { PublicListingRow } from "@/lib/publicListingModel";

function firstRow<T>(data: T[] | T | null | undefined): T | null {
  if (data == null) return null;
  return Array.isArray(data) ? (data[0] ?? null) : data;
}

/**
 * Gated DCMLS listing payload.
 * Uses `get_dcmls_listing` — never falls back to `get_public_listing` or `listings`.
 * Server enforces participation + publish_to_dcmls + published + public status.
 */
export async function fetchDcmlsListing(
  listingId: string,
): Promise<PublicListingRow | null> {
  const { data, error } = await supabase.rpc("get_dcmls_listing", {
    p_listing_id: listingId,
  });
  if (error) throw error;
  return firstRow(data) as PublicListingRow | null;
}

/** Agent-level DCMLS participation from agent_settings.
 * Missing row → false (agent self-service / listing forms). Prefer
 * `fetchDcmlsParticipationRow` when missing must be distinguished. */
export async function fetchDcmlsParticipation(userId: string): Promise<boolean> {
  const row = await fetchDcmlsParticipationRow(userId);
  return row.status === "on";
}

export type DcmlsParticipationRowStatus = "on" | "off" | "missing";

/** Distinguishes true / false / no agent_settings row. */
export async function fetchDcmlsParticipationRow(
  userId: string,
): Promise<{ status: DcmlsParticipationRowStatus }> {
  const { data, error } = await supabase
    .from("agent_settings")
    .select("dcmls_participation")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { status: "missing" };
  return { status: data.dcmls_participation === true ? "on" : "off" };
}

/**
 * Admin/agent update of `dcmls_participation` only.
 * Confirms exactly one settings row was updated via returning select.
 * Does not create a row. Timestamp is owned by the DB trigger.
 */
export async function updateDcmlsParticipation(
  userId: string,
  next: boolean,
): Promise<{ status: "on" | "off" }> {
  const { data, error } = await supabase
    .from("agent_settings")
    .update({ dcmls_participation: next })
    .eq("user_id", userId)
    .select("dcmls_participation")
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new Error("No agent_settings row updated");
  }
  return { status: data.dcmls_participation === true ? "on" : "off" };
}
