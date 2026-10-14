/**
 * Server-backed draft session for Create Hot Sheet.
 *
 * - Nothing is created until the first save() (opening the dialog never creates a draft).
 * - The first save creates exactly one draft row; later saves update that row.
 * - Only one save runs at a time; edits made during a save are saved next (latest wins).
 * - "saved" is reported only after the server confirms the latest snapshot.
 */
export type DraftSaveStatus = "idle" | "saving" | "saved" | "error";

export interface HotSheetDraftSnapshot {
  name: string;
  sheetType: "personal" | "buyer" | null;
  criteria: Record<string, unknown>;
  clientIds: string[];
  selectedListingIds: string[];
  notifyAgent: boolean;
  notificationSchedule: string;
}

export interface HotSheetDraftSessionDeps {
  /**
   * Create the draft row with the session's pre-assigned id. Must be idempotent:
   * if a row with that id already exists (a retry after a lost reply), update it instead.
   */
  create: (snap: HotSheetDraftSnapshot, id: string) => Promise<string>;
  update: (id: string, snap: HotSheetDraftSnapshot) => Promise<void>;
  onStatus?: (status: DraftSaveStatus) => void;
  onSavedKey?: (key: string) => void;
  /** Id generator for the session's single draft row (defaults to crypto.randomUUID). */
  newId?: () => string;
}

export const snapshotKey = (snap: HotSheetDraftSnapshot) => JSON.stringify(snap);

export function createHotSheetDraftSession(deps: HotSheetDraftSessionDeps, initialDraftId: string | null = null) {
  let draftId: string | null = initialDraftId;
  // Fixed for the life of the session, so retries can never create a second row.
  const sessionId: string = initialDraftId ?? (deps.newId ?? (() => crypto.randomUUID()))();
  let inflight: Promise<boolean> | null = null;
  let pending: HotSheetDraftSnapshot | null = null;
  let lastSavedKey: string | null = null;

  const setStatus = (s: DraftSaveStatus) => deps.onStatus?.(s);

  const runOne = async (snap: HotSheetDraftSnapshot): Promise<boolean> => {
    const key = snapshotKey(snap);
    try {
      if (!draftId) {
        draftId = await deps.create(snap, sessionId);
      } else {
        await deps.update(draftId, snap);
      }
      lastSavedKey = key;
      deps.onSavedKey?.(key);
      return true;
    } catch (e) {
      console.error("Hot Sheet draft save failed", e);
      return false;
    }
  };

  const loop = async (): Promise<boolean> => {
    setStatus("saving");
    while (pending) {
      const snap = pending;
      pending = null;
      const ok = await runOne(snap);
      if (!ok) {
        pending = null;
        inflight = null;
        setStatus("error");
        return false;
      }
    }
    inflight = null;
    setStatus("saved");
    return true;
  };

  return {
    getDraftId: () => draftId,
    /** The id this session will use (or already uses) for its one draft row. */
    getSessionId: () => sessionId,
    setDraftId: (id: string | null) => {
      draftId = id;
    },
    getLastSavedKey: () => lastSavedKey,
    markSaved: (key: string) => {
      lastSavedKey = key;
    },
    isSaving: () => inflight !== null,
    /** Queue the latest snapshot; resolves true once the server confirmed it. */
    save: (snap: HotSheetDraftSnapshot): Promise<boolean> => {
      pending = snap;
      if (!inflight) inflight = loop();
      return inflight;
    },
    /** Wait for any in-flight save to settle. */
    idle: async () => {
      if (inflight) await inflight.catch(() => false);
    },
  };
}

export type HotSheetDraftSession = ReturnType<typeof createHotSheetDraftSession>;

/** Display name for a draft row with no name yet. */
export function draftDisplayName(name: string | null | undefined): string {
  const n = (name ?? "").trim();
  return n || "Untitled draft";
}
