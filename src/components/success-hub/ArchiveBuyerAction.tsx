import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Shared archive/restore helpers for buyer relationships.
 * Archive  → status='archived', ended_at=now()
 * Restore  → status='active',   ended_at=null
 */
export async function archiveBuyerRelationship(opts: {
  agentId: string;
  buyerId: string;
}): Promise<boolean> {
  const { error } = await supabase
    .from("client_agent_relationships")
    .update({ status: "archived", ended_at: new Date().toISOString() })
    .eq("agent_id", opts.agentId)
    .or(`crm_client_id.eq.${opts.buyerId},client_id.eq.${opts.buyerId}`);
  if (error) {
    console.error(error);
    toast.error("Failed to archive buyer.");
    return false;
  }
  toast.success("Buyer archived.");
  return true;
}

export async function restoreBuyerRelationship(opts: {
  agentId: string;
  buyerId: string;
}): Promise<boolean> {
  const { error } = await supabase
    .from("client_agent_relationships")
    .update({ status: "active", ended_at: null })
    .eq("agent_id", opts.agentId)
    .or(`crm_client_id.eq.${opts.buyerId},client_id.eq.${opts.buyerId}`);
  if (error) {
    console.error(error);
    toast.error("Failed to restore buyer.");
    return false;
  }
  toast.success("Buyer restored.");
  return true;
}

/** Tiny hook to wire a busy state if a caller wants one. */
export function useArchiveBusy() {
  const [busy, setBusy] = useState(false);
  return { busy, setBusy };
}
