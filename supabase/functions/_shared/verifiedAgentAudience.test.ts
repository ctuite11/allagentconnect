import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { loadCommsOptIn } from "./commsOptIn.ts";
import { loadCommsSchedules, partitionByCommsSchedule } from "./commsDigest.ts";
import {
  getVerifiedAgentAudienceWithStats,
  partitionAudience,
  type EligibleAgent,
} from "./verifiedAgentAudience.ts";

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

Deno.test("no profile-image field is selected or used for inclusion", async () => {
  const src = await Deno.readTextFile(
    new URL("./verifiedAgentAudience.ts", import.meta.url),
  );
  assertEquals(/headshot/i.test(src), false);
  assertEquals(/profile.?photo/i.test(src), false);
  assertEquals(/avatar/i.test(src), false);
  assertEquals(/headshot_url/i.test(src), false);
  assertStringIncludes(src, "get_verified_agent_ids");
  assertStringIncludes(src, 'select("id, email, first_name, last_name")');

  // Agent with only a profile image still excluded when absent from the RPC.
  // Fixture includes an extra unused column to prove the helper never reads it.
  const { audience } = await getVerifiedAgentAudienceWithStats(
    fakeAudienceSupabase({
      rpcIds: [],
      profiles: [
        {
          id: "image-only",
          email: "image@example.com",
          first_name: "Image",
          last_name: "Only",
          headshot_url: "https://cdn.example/x.jpg",
        },
      ],
    }),
  );
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

Deno.test("audit SQL has no profile-image eligibility comparison", async () => {
  const sql = await Deno.readTextFile(
    new URL(
      "../../../docs/audits/2026-08-04-comms-audience-vs-network-rpc.sql",
      import.meta.url,
    ),
  );
  assertEquals(/headshot|profile.?photo/i.test(sql), false);
  assertEquals(sql.includes("get_verified_agent_ids()"), true);
  assertEquals(sql.includes("comms_base"), true);
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
