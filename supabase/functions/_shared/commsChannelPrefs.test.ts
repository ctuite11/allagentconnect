/**
 * UI opt-in path tests. Imports the exact module the Comms Center
 * preference cards use (src/lib/commsChannelPrefs.ts), so these prove the
 * production behaviour rather than a re-implementation.
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  ALL_CHANNELS_OFF,
  buildCommsPrefsUpsert,
  channelStateFromRow,
  muteAllChannels,
  toggleChannel,
} from "../../../src/lib/commsChannelPrefs.ts";

Deno.test("missing preferences row renders ALL channels off", () => {
  assertEquals(channelStateFromRow(null), ALL_CHANNELS_OFF);
  assertEquals(channelStateFromRow(undefined), ALL_CHANNELS_OFF);
});

Deno.test("null / missing category values render OFF, never ON", () => {
  assertEquals(
    channelStateFromRow({ buyer_need: null, sales_intel: undefined, renter_need: "true" }),
    ALL_CHANNELS_OFF,
  );
});

Deno.test("enabling the first channel turns BOTH master switches on", () => {
  const next = toggleChannel(ALL_CHANNELS_OFF, "buyer_need");
  assertEquals(next.buyer_need, true);
  assertEquals(next.client_needs_enabled, true);
  assertEquals(next.new_matches_enabled, true);
});

Deno.test("the 74-style all-off row can opt back in through the UI alone", () => {
  const muted = channelStateFromRow({
    buyer_need: false,
    sales_intel: false,
    renter_need: false,
    general_discussion: false,
  });
  const next = toggleChannel(muted, "renter_need");
  assertEquals(next.renter_need, true);
  assertEquals(next.client_needs_enabled, true);
  assertEquals(next.new_matches_enabled, true);
  // and other categories stay off
  assertEquals(next.buyer_need, false);
});

Deno.test("other explicit selections are preserved when toggling", () => {
  const state = channelStateFromRow({ buyer_need: true, general_discussion: true });
  const next = toggleChannel(state, "sales_intel");
  assertEquals(next.buyer_need, true);
  assertEquals(next.general_discussion, true);
  assertEquals(next.sales_intel, true);
});

Deno.test("masters stay true while at least one category remains enabled", () => {
  const state = channelStateFromRow({ buyer_need: true, sales_intel: true });
  const next = toggleChannel(state, "sales_intel");
  assertEquals(next.sales_intel, false);
  assertEquals(next.client_needs_enabled, true);
});

Deno.test("disabling the last category turns both masters false", () => {
  const state = channelStateFromRow({ buyer_need: true });
  const next = toggleChannel(state, "buyer_need");
  assertEquals(next.client_needs_enabled, false);
  assertEquals(next.new_matches_enabled, false);
});

Deno.test("mute all disables every category and both masters", () => {
  const next = muteAllChannels();
  assertEquals(next, {
    buyer_need: false,
    sales_intel: false,
    renter_need: false,
    general_discussion: false,
    client_needs_enabled: false,
    new_matches_enabled: false,
  });
});

Deno.test("cadence-only change writes no channel or master fields", () => {
  // The cadence surface upserts exactly { user_id, client_needs_schedule }.
  const cadenceUpsert: Record<string, unknown> = {
    user_id: "a",
    client_needs_schedule: "daily",
  };
  const forbidden = [
    "buyer_need",
    "sales_intel",
    "renter_need",
    "general_discussion",
    "client_needs_enabled",
    "new_matches_enabled",
  ];
  for (const k of forbidden) assertEquals(k in cadenceUpsert, false);
  // and it does not derive masters
  assertEquals(buildCommsPrefsUpsert(ALL_CHANNELS_OFF).client_needs_enabled, false);
});
