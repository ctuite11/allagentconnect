import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

// Execute the actual broadcaster twice (original vs isolated adapter), with
// every hosted client/provider boundary replaced by in-memory fixtures.
const CHRIS = "1fc50da1-2664-4931-8cab-64e24dc5ed8c";
const EMAIL = "chris@allagentconnect.com";
type Write = { table: string; operation: string; value: any };
const sourceUrl = new URL("../send-client-need-notification/index.ts", import.meta.url);
const source = await Deno.readTextFile(sourceUrl);
async function loadHandler(original: boolean) {
  let code = source
    .replace(/^import \{ serve \}.*;\n/m, "")
    .replace(/^import \{ createClient \}.*;\n/m,
      "const createClient = () => (globalThis as any).__chrisCommsMockClient;\n")
    .replaceAll(/from "(\.\.\/[^\"]+)"/g, (_match, path) => `from "${new URL(path, sourceUrl).href}"`)
    .replace("serve(handler);", "export default handler;");
  if (original) {
    code = code.replace("return chrisCommsBroadcastMatch(a, parsedCriteria, originalMatch);", "return originalMatch;");
  }
  return (await import(`data:application/typescript;base64,${btoa(code)}`)).default;
}
const baselineHandler = await loadHandler(true);
const correctedHandler = await loadHandler(false);

interface Scenario {
  category?: string;
  criteria?: any;
  scope?: string;
  sender?: string;
  copy?: boolean;
  draftPreview?: boolean;
  dryRun?: boolean;
  blocked?: string;
  suppressed?: boolean;
  hidden?: boolean;
  schedule?: string;
  muted?: boolean;
  duplicate?: boolean;
  pause?: boolean;
}
const defaultCriteria = {
  state: "MA", cities: ["Boston", "Newton"], minPrice: 2_000_000,
  maxPrice: 2_500_000, propertyTypes: ["single_family", "condo"],
};

function fixture(scenario: Scenario) {
  const writes: Write[] = [];
  const ids = [CHRIS, "town-county", "town", "county", "broad", "daily", "weekly", "incomplete", "no-email", "opt-out", "muted", "sender"];
  const profiles = ids.filter((id) => id !== "sender").map((id) => ({
    id, email: id === CHRIS ? EMAIL : id === "no-email" ? "" : `${id}@example.com`,
    first_name: id, last_name: "Fixture", company: "Fixture",
  }));
  profiles.push({ id: "sender", email: "sender@example.com", first_name: "Sender", last_name: "Fixture", company: "Fixture" });
  const prefs = ids.map((user_id) => ({
    user_id, client_needs_enabled: true, new_matches_enabled: true,
    buyer_need: true, renter_need: true, sales_intel: true, general_discussion: true,
    client_needs_schedule: user_id === "daily" ? "daily" : user_id === "weekly" ? "weekly" : "immediate",
    min_price: user_id === CHRIS ? 1_000_000 : null, max_price: null,
    property_types: user_id === CHRIS ? ["single_family", "condo", "townhouse", "multi_family", "land", "commercial", "residential_rental", "commercial_rental"] : [],
  }));
  const chrisPrefs = prefs.find((p) => p.user_id === CHRIS);
  if (chrisPrefs) {
    chrisPrefs.client_needs_schedule = scenario.schedule ?? "immediate";
    if (scenario.blocked) (chrisPrefs as any)[scenario.blocked] = false;
    if (scenario.muted) chrisPrefs.client_needs_enabled = false;
  }
  const optedOut = prefs.find((p) => p.user_id === "opt-out");
  if (optedOut) optedOut.buyer_need = false;
  const muted = prefs.find((p) => p.user_id === "muted");
  if (muted) muted.new_matches_enabled = false;
  const coverage = [
    { agent_id: CHRIS, state: "MA", city: "Boston", county: "Suffolk", zip_code: "00000", source: "notifications" },
    { agent_id: "town-county", state: "MA", city: "Newton", county: "Middlesex", source: "notifications" },
    { agent_id: "town", state: "MA", city: "Boston", source: "notifications" },
    { agent_id: "county", state: "MA", county: "Suffolk", source: "notifications" },
  ];
  const rows: Record<string, any[]> = {
    agent_profiles: profiles, agent_buyer_coverage_areas: coverage,
    notification_preferences: prefs,
    email_unsubscribes: scenario.suppressed ? [{ email: EMAIL }] : [],
    suppressed_emails: [],
    agent_sent_broadcasts: scenario.duplicate ? [{ agent_id: CHRIS }] : [],
  };
  const client = {
    auth: { getUser: () => Promise.resolve({ data: { user: { id: scenario.sender ?? "sender", email: "sender@example.com" } }, error: null }) },
    rpc: (name: string, args: any) => {
      if (name === "get_verified_agent_ids") return Promise.resolve({ data: ids.filter((id) => id !== CHRIS).map((user_id) => ({ user_id })), error: null });
      if (name === "get_comms_hidden_optin_agent_ids") return Promise.resolve({ data: scenario.hidden === false ? [] : [{ user_id: CHRIS }], error: null });
      if (name === "reserve_and_enqueue_missing_opportunity_reminder") {
        writes.push({ table: "reminder_rpc", operation: name, value: args });
        return Promise.resolve({ data: { reserved: true, queued: true }, error: null });
      }
      throw new Error(`Unexpected RPC ${name}`);
    },
    from: (table: string) => {
      let data = structuredClone(rows[table] ?? []);
      const query: any = {
        select: () => query,
        eq: (key: string, value: any) => { data = data.filter((r: any) => r[key] === value); return query; },
        in: (key: string, values: any[]) => { data = data.filter((r: any) => values.includes(r[key])); return query; },
        insert: (value: any) => {
          writes.push({ table, operation: "insert", value });
          if (table === "comms_broadcasts") data = [{ id: "fixture-broadcast" }];
          return query;
        },
        upsert: (value: any) => { writes.push({ table, operation: "upsert", value }); data = []; return query; },
        update: (value: any) => { writes.push({ table, operation: "update", value }); return query; },
        single: () => Promise.resolve({ data: data[0] ?? null, error: null }),
        then: (resolve: any, reject: any) => Promise.resolve({ data, error: null }).then(resolve, reject),
      };
      return query;
    },
  };
  return { client, writes };
}

async function run(handler: any, scenario: Scenario) {
  const { client, writes } = fixture(scenario);
  (globalThis as any).__chrisCommsMockClient = client;
  Deno.env.set("SUPABASE_URL", "http://localhost:9999");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "local-fixture-not-a-credential");
  Deno.env.set("COMMS_EMAILS_PAUSED", scenario.pause ? "true" : "false");
  Deno.env.set("EMAIL_SENDING_PAUSED", "false");
  const response = await handler(new Request("http://localhost/fixture", {
    method: "POST", headers: { Authorization: "Bearer local-fixture", "Content-Type": "application/json" },
    body: JSON.stringify({
      category: scenario.category ?? "buyer_need", subject: "Fixture post", message: "Fixture body",
      criteria: scenario.criteria ?? defaultCriteria, audience_scope: scenario.scope ?? "targeted",
      sendCopyToSelf: scenario.copy ?? false, dry_run: scenario.dryRun ?? false, previewOnly: scenario.draftPreview ?? false,
    }),
  }));
  assertEquals(response.status, 200);
  return { result: await response.json(), writes };
}
function nonChrisDeliveries(writes: Write[]) {
  return writes.flatMap((write) => {
    if (write.table === "email_jobs") return write.value.filter((job: any) => job.payload.to !== EMAIL).map((value: any) => ({ table: write.table, value }));
    if (["comms_digest_items", "agent_sent_broadcasts"].includes(write.table)) return write.value.filter((row: any) => row.agent_id !== CHRIS).map((value: any) => ({ table: write.table, value }));
    if (write.table === "reminder_rpc" && write.value._agent_id !== CHRIS) return [write];
    return [];
  });
}
function chrisJobs(writes: Write[]) {
  return writes.filter((w) => w.table === "email_jobs").flatMap((w) => w.value).filter((job: any) => job.payload.to === EMAIL);
}

Deno.test("Actual broadcaster preserves all non-Chris deliveries across categories, scopes and gates", async () => {
  const scenarios: Scenario[] = [
    {}, ...["renter_need", "sales_intel", "general_discussion"].map((category) => ({ category })),
    { criteria: { ...defaultCriteria, counties: ["Suffolk"] } },
    { criteria: { ...defaultCriteria, counties: ["Norfolk"] } },
    { criteria: { ...defaultCriteria, counties: ["Suffolk", "Norfolk"] } },
    { criteria: { ...defaultCriteria, cities: ["Cambridge"] } },
    { criteria: { state: "MA" } }, { criteria: {} }, { scope: "network_wide" },
    { suppressed: true }, { hidden: false }, { sender: CHRIS },
    { blocked: "client_needs_enabled" }, { blocked: "new_matches_enabled" }, { blocked: "buyer_need" },
    { schedule: "daily" }, { schedule: "weekly" }, { muted: true }, { duplicate: true }, { pause: true },
  ];
  for (const scenario of scenarios) {
    const before = await run(baselineHandler, scenario);
    const after = await run(correctedHandler, scenario);
    assertEquals(nonChrisDeliveries(after.writes), nonChrisDeliveries(before.writes));
  }
  const recovered = await run(correctedHandler, {});
  const jobs = chrisJobs(recovered.writes);
  assertEquals(jobs.length, 1);
  assertEquals(jobs[0].payload.to, "chris@allagentconnect.com");
  assertEquals(jobs[0].idempotency_key, `client-need-broadcast:fixture-broadcast:${CHRIS}`);
  assertEquals(jobs[0].payload.metadata.reason, "preferences_match");
  assertEquals(jobs[0].payload.cc, undefined);
  assertEquals(jobs[0].payload.bcc, undefined);
});

Deno.test("Actual broadcaster keeps suppression opt-in sender pause and dedup gates for Chris", async () => {
  for (const scenario of [{ suppressed: true }, { hidden: false }, { sender: CHRIS }, { blocked: "client_needs_enabled" }, { blocked: "new_matches_enabled" }, { blocked: "buyer_need" }, { duplicate: true }, { pause: true }]) {
    assertEquals(chrisJobs((await run(correctedHandler, scenario)).writes).length, 0);
  }
});

Deno.test("Actual broadcaster dry-run and preview perform zero writes and retain non-Chris roster", async () => {
  for (const scenario of [{ dryRun: true }, { draftPreview: true }]) {
    const before = await run(baselineHandler, scenario);
    const after = await run(correctedHandler, scenario);
    assertEquals(before.writes, []);
    assertEquals(after.writes, []);
    const others = (r: any) => r.recipients.filter((row: any) => row.email !== EMAIL);
    assertEquals(others(after.result), others(before.result));
  }
});

Deno.test("Sender-copy exception is limited to truthful recipient count and requires approval", async () => {
  const before = await run(baselineHandler, { copy: true });
  const after = await run(correctedHandler, { copy: true });
  const oldJobs = nonChrisDeliveries(before.writes);
  const newJobs = nonChrisDeliveries(after.writes);
  const copy = (items: any[]) => items.find((item) => item.table === "email_jobs" && item.value.payload.metadata.audience === "sender_copy");
  const oldCopy = copy(oldJobs);
  const newCopy = copy(newJobs);
  assertEquals(Boolean(oldCopy), true);
  assertEquals(Boolean(newCopy), true);
  assertEquals(newCopy.value.payload.variables.recipientCount, oldCopy.value.payload.variables.recipientCount + 1);
  assertEquals(newCopy.value.payload.variables.contentHtml, oldCopy.value.payload.variables.contentHtml.replace(`sent to ${oldCopy.value.payload.variables.recipientCount} recipients`, `sent to ${newCopy.value.payload.variables.recipientCount} recipients`));
  newCopy.value.payload.variables.recipientCount = oldCopy.value.payload.variables.recipientCount;
  newCopy.value.payload.variables.contentHtml = oldCopy.value.payload.variables.contentHtml;
  assertEquals(newJobs, oldJobs);
});