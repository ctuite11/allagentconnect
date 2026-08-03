/**
 * Session-scoped draft identity for Add Listing.
 * Insert-vs-update decisions must use the synchronous draft id ref (and the
 * shared in-flight create promise), not React state alone.
 */

export type DraftCreateResult = { id: string };

export type DraftCreateFn = () => Promise<DraftCreateResult | null>;

export type AddListingDraftSession = {
  getDraftId: () => string | null;
  /** Synchronously set the draft id ref (and notify React state via callback). */
  setDraftId: (id: string | null) => void;
  /** True while ensureDraftListing's shared create promise is outstanding. */
  isDraftCreationInFlight: () => boolean;
  /** Mark any save (manual, autosave, or related) as active for autosave skipping. */
  beginSave: () => void;
  endSave: () => void;
  isSaveActive: () => boolean;
  /**
   * Skip the debounced autosave tick while a save or draft creation is running.
   */
  shouldSkipAutosaveTick: () => boolean;
  /**
   * Single-flight draft creation. Concurrent callers await the same promise.
   * On success, the draft id ref is set synchronously before the lock clears.
   * On failure, the lock clears so a later retry can insert again.
   */
  ensureDraftListing: (create: DraftCreateFn) => Promise<string | null>;
};

export function createAddListingDraftSession(
  onDraftIdChange?: (id: string | null) => void,
): AddListingDraftSession {
  let draftId: string | null = null;
  let createInFlight: Promise<string | null> | null = null;
  let saveDepth = 0;

  const setDraftId = (id: string | null) => {
    draftId = id;
    onDraftIdChange?.(id);
  };

  const ensureDraftListing = async (create: DraftCreateFn): Promise<string | null> => {
    if (draftId) return draftId;
    if (createInFlight) return createInFlight;

    const run = (async (): Promise<string | null> => {
      try {
        if (draftId) return draftId;
        const created = await create();
        if (!created?.id) return null;
        // Requirement: set ref synchronously before releasing the in-flight lock.
        setDraftId(created.id);
        return created.id;
      } catch {
        return null;
      } finally {
        createInFlight = null;
      }
    })();

    createInFlight = run;
    return run;
  };

  return {
    getDraftId: () => draftId,
    setDraftId,
    isDraftCreationInFlight: () => createInFlight !== null,
    beginSave: () => {
      saveDepth += 1;
    },
    endSave: () => {
      saveDepth = Math.max(0, saveDepth - 1);
    },
    isSaveActive: () => saveDepth > 0,
    shouldSkipAutosaveTick: () => saveDepth > 0 || createInFlight !== null,
    ensureDraftListing,
  };
}
