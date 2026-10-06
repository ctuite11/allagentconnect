import { supabase } from "@/integrations/supabase/client";
import { invalidatePageData } from "@/lib/pageDataCache";

/**
 * Central invalidation for the short-lived Success Hub cache: any write the agent
 * makes to listings, hot sheets, or buyers marks the cached hub stale, so the next
 * visit refetches. Wraps the shared client once instead of touching every call site.
 */
const WATCHED_TABLES = new Set([
  "listings",
  "hot_sheets",
  "hot_sheet_clients",
  "clients",
  "client_agent_relationships",
  "share_tokens",
  "client_needs",
  "comms_broadcasts",
  "conversation_messages",
]);
const WRITE_METHODS = ["insert", "update", "upsert", "delete"] as const;
const MUTATING_RPC = /^(create|delete|update|end|accept|activate|archive|dispatch|enqueue|set|save|remove|add|upsert|agent_end|agent_reactivate|admin_)/;

declare global {
  interface Window {
    __aacHubCacheInvalidationPatched?: boolean;
  }
}

if (typeof window !== "undefined" && !window.__aacHubCacheInvalidationPatched) {
  window.__aacHubCacheInvalidationPatched = true;
  const client = supabase as any;

  const originalFrom = client.from.bind(client);
  client.from = (table: string) => {
    const builder = originalFrom(table);
    if (WATCHED_TABLES.has(table)) {
      for (const m of WRITE_METHODS) {
        const orig = builder[m]?.bind(builder);
        if (orig) {
          builder[m] = (...args: unknown[]) => {
            invalidatePageData();
            return orig(...args);
          };
        }
      }
    }
    return builder;
  };

  const originalRpc = client.rpc.bind(client);
  client.rpc = (fn: string, ...rest: unknown[]) => {
    if (MUTATING_RPC.test(fn)) invalidatePageData();
    return originalRpc(fn, ...rest);
  };
}

export {};
