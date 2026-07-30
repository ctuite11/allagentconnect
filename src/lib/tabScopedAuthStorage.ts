const AUTH_STORAGE_PREFIX = "sb-";
const AUTH_STORAGE_SUFFIX = "-auth-token";
const TAB_SCOPED_PREFIX = "aac-tab-scoped-auth:";

declare global {
  interface Window {
    __aacTabScopedAuthPatched?: boolean;
  }
}

const isAuthStorageKey = (key: string | null | undefined): key is string =>
  typeof key === "string" &&
  key.startsWith(AUTH_STORAGE_PREFIX) &&
  key.endsWith(AUTH_STORAGE_SUFFIX);

/**
 * Restore durable (localStorage) auth sessions.
 *
 * This module previously redirected the backend auth-token key into
 * sessionStorage so sessions stayed tab-local. That also meant every browser
 * restart signed the user out. Sessions now live in localStorage again (the
 * generated client's configured storage); cross-tab account switches are
 * surfaced by `CrossTabSessionGuard` instead of being prevented by force.
 *
 * On first load we migrate any leftover tab-scoped token back to localStorage
 * so existing sessions survive this change.
 */
if (typeof window !== "undefined" && !window.__aacTabScopedAuthPatched) {
  window.__aacTabScopedAuthPatched = true;

  try {
    const scopedKeys: string[] = [];
    for (let i = 0; i < window.sessionStorage.length; i += 1) {
      const key = window.sessionStorage.key(i);
      if (key && key.startsWith(TAB_SCOPED_PREFIX)) scopedKeys.push(key);
    }

    for (const scoped of scopedKeys) {
      const originalKey = scoped.slice(TAB_SCOPED_PREFIX.length);
      const value = window.sessionStorage.getItem(scoped);
      if (isAuthStorageKey(originalKey) && value !== null) {
        if (window.localStorage.getItem(originalKey) === null) {
          window.localStorage.setItem(originalKey, value);
        }
      }
      window.sessionStorage.removeItem(scoped);
    }
  } catch {
    // Storage can be unavailable (private mode / blocked cookies) — ignore.
  }
}

export {};