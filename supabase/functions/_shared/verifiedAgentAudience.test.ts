import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { loadCommsOptIn } from "./commsOptIn.ts";
import { loadCommsSchedules, partitionByCommsSchedule } from "./commsDigest.ts";
import {
  getVerifiedAgentAudienceWithStats,
  partitionAudience,
  type EligibleAgent,
} from "./verifiedAgentAudience.ts";
import { matchesCommunicationPreferences } from "./communicationPreferencesMatcher.ts";

const ON = {
  client_needs_enabled: true,
  new_matches_enabled: true,
  buyer_need: true,
  renter_need: true,
  sales_intel: true,
  general_discussion: true,
};

type TableRow = Record<string, unknown>;

type AudienceDb = {
  rpcIds: string[];
  profiles?: TableRow[];
  coverage?: TableRow[];
  notifPrefs?: TableRow[];
  unsubscribes?: TableRow[];
  suppressed?: TableRow[];
  rpcError?: unknown;
};

function chainable(result: { data: unknown; error: unknown }) {
  const api: any = {
    select: () => api,
    eq: () => api,
    in: () => Promise.resolve(result),
    maybeSingle: () => Promise.resolve(result),
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  };
  return api;
}

function fakeAudienceSupabase(db: AudienceDb) {
  return {
    rpc: (name: string) => {
      assertEquals(name, "get_verified_agent_ids");
      if (db.rpcError) return Promise.resolve({ data: null, error: db.rpcError });
      return Promise.resolve({
        data: db.rpcIds.map((user_id) => ({ user_id })),
        error: null,
      });
    },
    from: (table: string) => {
      if (table === "agent_profiles") {
        return chainable({ data: db.profiles ?? [], error: null });
      }
      if (table === "agent_buyer_coverage_areas") {
        return chainable({ data: db.coverage ?? [], error: null });
      }
      if (table === "notification_preferences") {
        return chainable({ data: db.notifPrefs ?? [], error: null });
      }
      if (table === "email_unsubscribes") {
        return chainable({ data: db.unsubscribes ?? [], error: null });
      }
      if (table === "suppressed_emails") {
        return chainable({ data: db.suppressed ?? [], error: null });
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
}

function agent(
  id: string,
  overrides: Partial<EligibleAgent> = {},
): EligibleAgent {
  return {
    agent_id: id,
    email: `${id}@x.com`,
    first_name: id,
    last_name: null,
    preferences_set: false,
    profile_complete: true,
    has_email: true,
    savedPrefs: {
      geoRows: [],
      minPrice: null,
      maxPrice: null,
      hasNoMin: false,
      hasNoMax: false,
      propertyTypes: [],
    },
    ...overrides,
  };
}

Deno.test("Communications base IDs exactly equal get_verified_agent_ids() IDs", async () => {
  const rpcIds = ["net-1", "net-2", "net-3"];
  const { audience, network_rpc_base } = await getVerifiedAgentAudienceWithStats(
    fakeAudienceSupabase({
      rpcIds,
      profiles: rpcIds.map((id) => ({
        id,
        email: `${id}@example.com`,
        first_name: "A",
        last_name: "B",
      })),
    }),
  );
  assertEquals(audience.map((a) => a.agent_id).sort(), [...rpcIds].sort());
  assertEquals(network_rpc_base, 3);
});

Deno.test("unactivated agent outside the Network RPC is never included", async () => {
  const { audience } = await getVerifiedAgentAudienceWithStats(
    fakeAudienceSupabase({
      rpcIds: ["activated-network"],
      profiles: [
        {
          id: "activated-network",
          email: "in@example.com",
          first_name: "In",
          last_name: "Network",
        },
        {
          // Present in profiles table but NOT returned by the RPC.
          id: "unactivated-verified",
          email: "out@example.com",
          first_name: "Out",
          last_name: "Network",
        },
      ],
    }),
  );
  assertEquals(audience.map((a) => a.agent_id), ["activated-network"]);
  assertEquals(audience.some((a) => a.agent_id === "unactivated-verified"), false);
});

Deno.test("helper selects only delivery profile fields after Network RPC base load", async () => {
  const src = await Deno.readTextFile(
    new URL("./verifiedAgentAudience.ts", import.meta.url),
  );
  assertStringIncludes(src, "get_verified_agent_ids");
  assertStringIncludes(src, 'select("id, email, first_name, last_name")');
  assertEquals(src.includes('.from("agent_settings")'), false);
  assertEquals(src.includes('.from("user_roles")'), false);

  // Agents absent from the RPC are never included, even if a profile row exists.
  const { audience, network_rpc_base } = await getVerifiedAgentAudienceWithStats(
    fakeAudienceSupabase({
      rpcIds: [],
      profiles: [
        {
          id: "not-in-network",
          email: "out@example.com",
          first_name: "Out",
          last_name: "Network",
        },
      ],
    }),
  );
  assertEquals(network_rpc_base, 0);
  assertEquals(audience.length, 0);
});

Deno.test("helper does not independently query agent_settings or user_roles for eligibility", async () => {
  const src = await Deno.readTextFile(
    new URL("./verifiedAgentAudience.ts", import.meta.url),
  );
  assertEquals(src.includes('.from("agent_settings")'), false);
  assertEquals(src.includes('.from("user_roles")'), false);
  assertEquals(src.includes("account_activated_at"), false);
  assertEquals(src.includes("hide_from_directory"), false);
  assertEquals(src.includes("agent_status"), false);
});

Deno.test("sender, opt-in, category, targeting, suppression, and cadence still operate after base load", async () => {
  const rpcIds = ["sender", "opted-in", "cat-off", "suppressed", "daily", "nomatch"];
  const { audience, globally_suppressed, network_rpc_base } = await getVerifiedAgentAudienceWithStats(
    fakeAudienceSupabase({
      rpcIds,
      profiles: [
        { id: "sender", email: "sender@example.com", first_name: "S", last_name: "Ender" },
        { id: "opted-in", email: "in@example.com", first_name: "O", last_name: "In" },
        { id: "cat-off", email: "cat@example.com", first_name: "C", last_name: "Off" },
        { id: "suppressed", email: "supp@example.com", first_name: "Su", last_name: "Pp" },
        { id: "daily", email: "daily@example.com", first_name: "D", last_name: "Aily" },
        { id: "nomatch", email: "nomatch@example.com", first_name: "No", last_name: "Match" },
      ],
      coverage: [
        {
          agent_id: "nomatch",
          state: "MA",
          county: null,
          city: "Boston",
          zip_code: null,
          neighborhood: null,
        },
      ],
      suppressed: [{ email: "supp@example.com" }],
    }),
  );

  assertEquals(network_rpc_base, 6);
  assertEquals(globally_suppressed, 1);
  assertEquals(audience.some((a) => a.agent_id === "suppressed"), false);
  assertEquals(
    audience.map((a) => a.agent_id).sort(),
    ["cat-off", "daily", "nomatch", "opted-in", "sender"].sort(),
  );

  const optInRows = [
    { user_id: "sender", ...ON },
    { user_id: "opted-in", ...ON },
    { user_id: "cat-off", ...ON, buyer_need: false },
    { user_id: "daily", ...ON },
    { user_id: "nomatch", ...ON },
  ];
  const lookup = await loadCommsOptIn(
    {
      from: () => chainable({ data: optInRows, error: null }),
    },
    audience.map((a) => a.agent_id),
    "buyer_need",
  );

  const partition = partitionAudience(
    audience,
    (a) => a.agent_id !== "nomatch",
    "sender",
    undefined,
    lookup.allowed,
  );
  assertEquals(partition.counts.self_excluded, 1);
  assertEquals(partition.counts.comms_opt_in_blocked, 1); // cat-off
  assertEquals(partition.counts.non_matching, 1); // nomatch geo miss
  assertEquals(
    partition.real.map((r) => r.agent_id).sort(),
    ["daily", "opted-in"].sort(),
  );

  const scheduleRows = [
    { user_id: "opted-in", ...ON, client_needs_schedule: "immediate" },
    { user_id: "daily", ...ON, client_needs_schedule: "daily" },
  ];
  const { schedules, muted } = await loadCommsSchedules(
    { from: () => chainable({ data: scheduleRows, error: null }) },
    partition.real.map((r) => r.agent_id),
  );
  const { immediate, digest, skippedMuted } = partitionByCommsSchedule(
    partition.real.map((r) => ({ agent_id: r.agent_id })),
    schedules,
    muted,
  );
  assertEquals(immediate.map((a) => a.agent_id), ["opted-in"]);
  assertEquals(digest.map((a) => `${a.agent_id}:${a.cadence}`), ["daily:daily"]);
  assertEquals(skippedMuted, 0);
});

Deno.test("empty Network RPC yields empty Communications base audience", async () => {
  const { audience, globally_suppressed, network_rpc_base } =
    await getVerifiedAgentAudienceWithStats(fakeAudienceSupabase({ rpcIds: [] }));
  assertEquals(audience, []);
  assertEquals(globally_suppressed, 0);
  assertEquals(network_rpc_base, 0);
});

Deno.test("partition still excludes sender after Network-aligned base audience", () => {
  const audience = [agent("sender"), agent("peer")];
  const p = partitionAudience(
    audience,
    () => true,
    "sender",
    undefined,
    new Set(["sender", "peer"]),
  );
  assertEquals(p.real.map((r) => r.agent_id), ["peer"]);
  assertEquals(p.counts.self_excluded, 1);
});

Deno.test("audit SQL compares Network RPC and Communications base for exact parity", async () => {
  const sql = await Deno.readTextFile(
    new URL(
      "../../../docs/audits/2026-08-04-comms-audience-vs-network-rpc.sql",
      import.meta.url,
    ),
  );
  assertEquals(sql.includes("get_verified_agent_ids()"), true);
  assertEquals(sql.includes("comms_base"), true);
  assertEquals(sql.includes("network_rpc_count"), true);
  assertEquals(sql.includes("comms_base_count"), true);
});

Deno.test("all five Comms Edge consumers use the Network-aligned audience helper", async () => {
  const consumers = [
    "supabase/functions/notify-agents/index.ts",
    "supabase/functions/notify-agents-client-need/index.ts",
    "supabase/functions/send-client-need-notification/index.ts",
    "supabase/functions/send-seller-alert/index.ts",
    "supabase/functions/process-comms-digests/index.ts",
  ];
  for (const f of consumers) {
    const src = await Deno.readTextFile(new URL(`../../../${f}`, import.meta.url));
    assertEquals(
      src.includes("verifiedAgentAudience.ts"),
      true,
      `${f} must import verifiedAgentAudience`,
    );
  }

  const digestSrc = await Deno.readTextFile(
    new URL("../../../supabase/functions/process-comms-digests/index.ts", import.meta.url),
  );
  assertEquals(digestSrc.includes("loadVerifiedAgentIdSet"), true);
  assertEquals(digestSrc.includes("get_verified_agent_ids()"), true);
});

// ---------------------------------------------------------------------------
// Placeholder-ZIP normalization (Aug 2026)
//
// Comms Center coverage is town/state selected; the agent never picks a ZIP.
// The table requires a ZIP and uniques on it, so the UI writes counter
// placeholders ("00000", "00001", "00002", ...). Those must never act as a
// geographic restriction.
// ---------------------------------------------------------------------------

function coverageRow(agent_id: string, city: string, zip_code: string) {
  return {
    agent_id,
    state: "MA",
    county: null,
    city,
    zip_code,
    neighborhood: null,
  };
}

async function audienceWithCoverage(coverage: TableRow[]) {
  const { audience } = await getVerifiedAgentAudienceWithStats(
    fakeAudienceSupabase({
      rpcIds: ["a1"],
      profiles: [{ id: "a1", email: "a1@example.com", first_name: "A", last_name: "One" }],
      coverage,
    }),
  );
  return audience[0];
}

Deno.test("notifications coverage rows drop placeholder ZIPs of every value", async () => {
  const a = await audienceWithCoverage([
    coverageRow("a1", "Abington", "00000"),
    coverageRow("a1", "Acton", "00001"),
    coverageRow("a1", "Boston", "00002"),
    coverageRow("a1", "Newton", "00045"),
    coverageRow("a1", "Worcester", "00345"),
  ]);
  assertEquals(a.savedPrefs.geoRows.length, 5);
  assertEquals(a.savedPrefs.geoRows.every((r) => r.zip_code === null), true);
  assertEquals(a.preferences_set, true);
});

Deno.test("town saved with placeholder 00002+ now matches a listing in that town", async () => {
  const a = await audienceWithCoverage([
    coverageRow("a1", "Abington", "00000"),
    coverageRow("a1", "Boston", "00002"),
    coverageRow("a1", "Worcester", "00345"),
  ]);
  for (const [city, zip] of [["Boston", "02118"], ["Worcester", "01604"]]) {
    const res = matchesCommunicationPreferences(a.savedPrefs, {
      state: "MA",
      city,
      zip,
      price: 750000,
      propertyTypes: ["condo"],
    });
    assertEquals(res.matches, true, `${city} should match`);
  }
});

Deno.test("a genuinely different town still does not match", async () => {
  const a = await audienceWithCoverage([
    coverageRow("a1", "Boston", "00002"),
    coverageRow("a1", "Worcester", "00345"),
  ]);
  const res = matchesCommunicationPreferences(a.savedPrefs, {
    state: "MA",
    city: "Springfield",
    zip: "01103",
    price: 500000,
    propertyTypes: ["single_family"],
  });
  assertEquals(res.matches, false);
  assertEquals(res.failedDimension, "location");
});

Deno.test("a different state still does not match", async () => {
  const a = await audienceWithCoverage([coverageRow("a1", "Boston", "00002")]);
  const res = matchesCommunicationPreferences(a.savedPrefs, {
    state: "NH",
    city: "Boston",
    zip: "03060",
  });
  assertEquals(res.matches, false);
});

Deno.test("matcher still enforces real ZIPs supplied outside the notifications path", () => {
  const prefs = {
    geoRows: [{ state: "MA", county: null, city: null, zip_code: "02118", neighborhood: null }],
    minPrice: null,
    maxPrice: null,
    hasNoMin: false,
    hasNoMax: false,
    propertyTypes: [] as string[],
  };
  assertEquals(
    matchesCommunicationPreferences(prefs, { state: "MA", city: "Boston", zip: "02118" }).matches,
    true,
  );
  assertEquals(
    matchesCommunicationPreferences(prefs, { state: "MA", city: "Boston", zip: "02135" }).matches,
    false,
  );
});
