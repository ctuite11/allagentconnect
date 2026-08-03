/**
 * Session-scoped draft identity for Add Listing.
 * Insert-vs-update decisions must use the synchronous draft id ref (and the
 * shared in-flight create promise), not React state alone.
 *
 * Also owns skipped-autosave re-arm: when a debounce tick is skipped because a
 * save/create is in flight, at most one delayed retry is scheduled after idle
 * if the form is still dirty — never a tight loop or overlapping saves.
 */

export type DraftCreateResult = { id: string };

export type DraftCreateFn = () => Promise<DraftCreateResult | null>;

export type ScheduleFn = (fn: () => void, ms: number) => unknown;
export type ClearScheduleFn = (handle: unknown) => void;

/** Delay before a single re-armed autosave after in-flight work becomes idle. */
export const AUTOSAVE_RETRY_AFTER_IDLE_MS = 1000;

export type AddListingDraftSessionOptions = {
  /** Still dirty after the in-flight op finishes? */
  isDirty?: () => boolean;
  /** Run one autosave attempt (must itself call beginSave/endSave). */
  runAutosave?: () => void;
  retryDelayMs?: number;
  schedule?: ScheduleFn;
  clearSchedule?: ClearScheduleFn;
};

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
   * Remember that an autosave tick was skipped so we can re-arm once idle
   * (only if still dirty). Idempotent — does not stack timers by itself.
   */
  noteSkippedAutosaveTick: () => void;
  /** Cancel any pending skipped-autosave retry (unmount / explicit clear). */
  clearPendingAutosaveRetry: () => void;
  /** True when a skipped tick is waiting for idle (timer may or may not be armed). */
  hasPendingAutosaveRetry: () => boolean;
  /**
   * Single-flight draft creation. Concurrent callers await the same promise.
   * On success, the draft id ref is set synchronously before the lock clears.
   * On failure, the lock clears so a later retry can insert again.
   */
  ensureDraftListing: (create: DraftCreateFn) => Promise<string | null>;
};

export function createAddListingDraftSession(
  onDraftIdChange?: (id: string | null) => void,
  options: AddListingDraftSessionOptions = {},
): AddListingDraftSession {
  let draftId: string | null = null;
  let createInFlight: Promise<string | null> | null = null;
  let saveDepth = 0;

  let pendingAutosaveRetry = false;
  let retryTimer: unknown = null;

  const retryDelayMs = options.retryDelayMs ?? AUTOSAVE_RETRY_AFTER_IDLE_MS;
  const schedule: ScheduleFn = options.schedule ?? ((fn, ms) => setTimeout(fn, ms));
  const clearSchedule: ClearScheduleFn =
    options.clearSchedule ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));

  const setDraftId = (id: string | null) => {
    draftId = id;
    onDraftIdChange?.(id);
  };

  const isBusy = () => saveDepth > 0 || createInFlight !== null;

  const clearRetryTimer = () => {
    if (retryTimer != null) {
      clearSchedule(retryTimer);
      retryTimer = null;
    }
  };

  const clearPendingAutosaveRetry = () => {
    pendingAutosaveRetry = false;
    clearRetryTimer();
  };

  const maybeScheduleRetryAfterIdle = () => {
    if (!pendingAutosaveRetry) return;
    if (isBusy()) return;

    const dirty = options.isDirty?.() ?? false;
    if (!dirty) {
      clearPendingAutosaveRetry();
      return;
    }

    // One timer only — repeated skips while busy do not stack timers.
    if (retryTimer != null) return;

    retryTimer = schedule(() => {
      retryTimer = null;
      // Consume this arming; if we must skip again, noteSkipped will re-set.
      pendingAutosaveRetry = false;

      if (isBusy()) {
        pendingAutosaveRetry = true;
        return;
      }
      if (!(options.isDirty?.() ?? false)) {
        return;
      }
      options.runAutosave?.();
    }, retryDelayMs);
  };

  const noteSkippedAutosaveTick = () => {
    pendingAutosaveRetry = true;
    maybeScheduleRetryAfterIdle();
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
        maybeScheduleRetryAfterIdle();
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
      maybeScheduleRetryAfterIdle();
    },
    isSaveActive: () => saveDepth > 0,
    shouldSkipAutosaveTick: () => isBusy(),
    noteSkippedAutosaveTick,
    clearPendingAutosaveRetry,
    hasPendingAutosaveRetry: () => pendingAutosaveRetry || retryTimer != null,
    ensureDraftListing,
  };
}
