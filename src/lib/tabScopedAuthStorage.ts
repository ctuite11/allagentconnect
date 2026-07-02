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

const scopedKey = (key: string) => `${TAB_SCOPED_PREFIX}${key}`;

/**
 * Keep auth sessions scoped to the current browser tab.
 *
 * The generated backend client is configured with localStorage, which is shared
 * across tabs. That makes an admin tab adopt a test account when another tab
 * signs in. This shim runs before the client is created and redirects only the
 * backend auth-token key to sessionStorage, while also silencing the matching
 * auth BroadcastChannel so sign-in/sign-out events stay tab-local.
 */
if (typeof window !== "undefined" && !window.__aacTabScopedAuthPatched) {
  window.__aacTabScopedAuthPatched = true;

  const nativeGetItem = Storage.prototype.getItem;
  const nativeSetItem = Storage.prototype.setItem;
  const nativeRemoveItem = Storage.prototype.removeItem;

  const migrateLegacyToken = (key: string) => {
    const sessionKey = scopedKey(key);
    const existingTabValue = nativeGetItem.call(window.sessionStorage, sessionKey);
    if (existingTabValue !== null) return existingTabValue;

    const legacyValue = nativeGetItem.call(window.localStorage, key);
    if (legacyValue !== null) {
      nativeSetItem.call(window.sessionStorage, sessionKey, legacyValue);
      nativeRemoveItem.call(window.localStorage, key);
    }
    return legacyValue;
  };

  Storage.prototype.getItem = function patchedGetItem(key: string) {
    if (this === window.localStorage && isAuthStorageKey(key)) {
      return migrateLegacyToken(key);
    }
    return nativeGetItem.call(this, key);
  };

  Storage.prototype.setItem = function patchedSetItem(key: string, value: string) {
    if (this === window.localStorage && isAuthStorageKey(key)) {
      nativeSetItem.call(window.sessionStorage, scopedKey(key), value);
      nativeRemoveItem.call(window.localStorage, key);
      return;
    }
    nativeSetItem.call(this, key, value);
  };

  Storage.prototype.removeItem = function patchedRemoveItem(key: string) {
    if (this === window.localStorage && isAuthStorageKey(key)) {
      nativeRemoveItem.call(window.sessionStorage, scopedKey(key));
      nativeRemoveItem.call(window.localStorage, key);
      return;
    }
    nativeRemoveItem.call(this, key);
  };

  if (typeof window.BroadcastChannel === "function") {
    const NativeBroadcastChannel = window.BroadcastChannel;

    class TabLocalAuthBroadcastChannel extends EventTarget {
      readonly name: string;
      onmessage: ((this: BroadcastChannel, ev: MessageEvent) => unknown) | null = null;
      onmessageerror: ((this: BroadcastChannel, ev: MessageEvent) => unknown) | null = null;

      constructor(name: string) {
        super();
        this.name = name;
      }

      postMessage() {
        // Intentionally no-op: auth state must not broadcast across tabs.
      }

      close() {
        // Intentionally no-op.
      }
    }

    window.BroadcastChannel = new Proxy(NativeBroadcastChannel, {
      construct(target, args) {
        const name = typeof args[0] === "string" ? args[0] : String(args[0] ?? "");
        if (isAuthStorageKey(name)) {
          return new TabLocalAuthBroadcastChannel(name) as unknown as BroadcastChannel;
        }
        return Reflect.construct(target, args);
      },
    }) as typeof BroadcastChannel;
  }
}

export {};