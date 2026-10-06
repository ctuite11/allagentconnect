/**
 * Short-lived, per-user in-memory cache for workspace page data (Success Hub).
 * Lets Back navigation render instantly from the last result and refresh quietly.
 * Entries are scoped by user ID and wiped on sign-out / account change.
 */
export const PAGE_DATA_FRESH_MS = 60_000;
const MAX_AGE_MS = 10 * 60_000;

type Entry = { userId: string; value: unknown; at: number };
const store = new Map<string, Entry>();
let ownerUserId: string | null = null;

export function getPageData<T>(key: string, userId: string | null | undefined): { value: T; fresh: boolean } | null {
  if (!userId) return null;
  const e = store.get(key);
  if (!e || e.userId !== userId) return null;
  const age = Date.now() - e.at;
  if (age > MAX_AGE_MS) {
    store.delete(key);
    return null;
  }
  return { value: e.value as T, fresh: age < PAGE_DATA_FRESH_MS };
}

export function setPageData(key: string, userId: string | null | undefined, value: unknown): void {
  if (!userId) return;
  if (ownerUserId && ownerUserId !== userId) store.clear();
  ownerUserId = userId;
  store.set(key, { userId, value, at: Date.now() });
}

/** Mark Success Hub data stale (agent's own listing / hot sheet / buyer changes). */
export function invalidatePageData(prefix = "success-hub"): void {
  for (const k of [...store.keys()]) if (k.startsWith(prefix)) store.delete(k);
}

/** Called on sign-out and whenever the signed-in user changes. */
export function clearAllPageData(): void {
  store.clear();
  ownerUserId = null;
}
