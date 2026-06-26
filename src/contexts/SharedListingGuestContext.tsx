import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  clearGuestListing,
  getGuestListingId,
  setGuestListingIdIfAbsent as storageSetGuestListingIdIfAbsent,
} from "@/lib/sharedListingGuest";

interface SharedListingGuestState {
  /** True when the visitor first landed via a shared listing link. */
  isGuest: boolean;
  /** The listing id the guest is allowed to view freely. */
  allowedListingId: string | null;
  /** Set the allowed listing id (first-write-wins). */
  registerGuestListing: (listingId: string) => void;
  /** Clear guest mode after successful auth. */
  clearGuest: () => void;
}

const SharedListingGuestContext = createContext<SharedListingGuestState | null>(
  null,
);

export function SharedListingGuestProvider({ children }: { children: ReactNode }) {
  const [allowedListingId, setAllowedListingId] = useState<string | null>(() =>
    getGuestListingId(),
  );

  // Keep state in sync with other tabs / late-mounted writers.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== "aac_shared_listing_guest") return;
      setAllowedListingId(getGuestListingId());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const registerGuestListing = useCallback((listingId: string) => {
    if (!listingId) return;
    storageSetGuestListingIdIfAbsent(listingId);
    setAllowedListingId((prev) => prev ?? getGuestListingId());
  }, []);

  const clearGuest = useCallback(() => {
    clearGuestListing();
    setAllowedListingId(null);
  }, []);

  const value = useMemo<SharedListingGuestState>(
    () => ({
      isGuest: !!allowedListingId,
      allowedListingId,
      registerGuestListing,
      clearGuest,
    }),
    [allowedListingId, registerGuestListing, clearGuest],
  );

  return (
    <SharedListingGuestContext.Provider value={value}>
      {children}
    </SharedListingGuestContext.Provider>
  );
}

export function useSharedListingGuest(): SharedListingGuestState {
  const ctx = useContext(SharedListingGuestContext);
  if (!ctx) {
    // Safe default if a tree mounts outside the provider — never gate.
    return {
      isGuest: false,
      allowedListingId: null,
      registerGuestListing: () => {},
      clearGuest: () => {},
    };
  }
  return ctx;
}