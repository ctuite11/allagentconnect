/**
 * Comms Center channel preference logic (Aug 2026 opt-in policy).
 *
 * Pure, UI-independent so it can be unit tested:
 *   - a missing notification_preferences row means ALL channels OFF
 *   - null / missing category values render OFF, never ON
 *   - enabling the first category also turns BOTH master switches on
 *   - disabling the last category turns both master switches off
 *   - cadence changes never touch any of these fields
 */

export type CommsChannelKey =
  | "buyer_need"
  | "sales_intel"
  | "renter_need"
  | "general_discussion";

export type CommsChannelState = Record<CommsChannelKey, boolean>;

export const COMMS_CHANNEL_KEYS: CommsChannelKey[] = [
  "buyer_need",
  "sales_intel",
  "renter_need",
  "general_discussion",
];

export const ALL_CHANNELS_OFF: CommsChannelState = {
  buyer_need: false,
  sales_intel: false,
  renter_need: false,
  general_discussion: false,
};

/** Missing row (null/undefined) or null columns ⇒ OFF. Only `true` is ON. */
export function channelStateFromRow(
  row: Partial<Record<CommsChannelKey, unknown>> | null | undefined,
): CommsChannelState {
  const out = { ...ALL_CHANNELS_OFF };
  if (!row) return out;
  for (const key of COMMS_CHANNEL_KEYS) out[key] = row[key] === true;
  return out;
}

export type CommsPrefsUpsert = CommsChannelState & {
  client_needs_enabled: boolean;
  new_matches_enabled: boolean;
};

/** Master switches mirror "at least one category enabled". */
export function buildCommsPrefsUpsert(state: CommsChannelState): CommsPrefsUpsert {
  const anyOn = COMMS_CHANNEL_KEYS.some((k) => state[k] === true);
  return { ...state, client_needs_enabled: anyOn, new_matches_enabled: anyOn };
}

/** Toggle one category, preserving every other explicit selection. */
export function toggleChannel(
  state: CommsChannelState,
  key: CommsChannelKey,
): CommsPrefsUpsert {
  return buildCommsPrefsUpsert({ ...state, [key]: !state[key] });
}

/** "Mute all": every category and both master switches false. */
export function muteAllChannels(): CommsPrefsUpsert {
  return buildCommsPrefsUpsert({ ...ALL_CHANNELS_OFF });
}
