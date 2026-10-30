import { createMigrationFetch } from "../../supabase/functions/_shared/migrationSafety.ts";

/** Browser defense in depth; server-side and SQL controls remain authoritative. */
export const migrationClientFetch = createMigrationFetch(globalThis.fetch.bind(globalThis), (name) => {
  switch (name) {
    case "SUPABASE_URL": return import.meta.env.VITE_SUPABASE_URL;
    case "MIGRATION_OUTBOUND_DISABLED": return import.meta.env.VITE_MIGRATION_OUTBOUND_DISABLED;
    case "MIGRATION_RELEASE_APPROVED": return import.meta.env.VITE_MIGRATION_RELEASE_APPROVED;
    default: return undefined;
  }
});
