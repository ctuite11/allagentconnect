import { lazy, type ComponentType } from "react";

const CHUNK_RELOAD_KEY = "aac_chunk_reloaded_at";
const STALE = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError/i;

/**
 * React.lazy that survives a stale tab: if a section's file can't be fetched
 * (new deploy / dev reload replaced it), retry once, then reload the page once
 * per minute instead of leaving a blank screen.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (err) {
      if (!STALE.test(String((err as Error)?.message ?? err))) throw err;
      await new Promise((r) => setTimeout(r, 600));
      try {
        return await factory();
      } catch (err2) {
        try {
          const last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || 0);
          if (Date.now() - last >= 60_000) {
            sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
            window.location.reload();
            return new Promise<never>(() => {});
          }
        } catch {
          // ignore
        }
        throw err2;
      }
    }
  });
}
