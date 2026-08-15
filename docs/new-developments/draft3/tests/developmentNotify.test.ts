// DRAFT 3 — not deployed. On apply, move to
// supabase/functions/_shared/developmentNotify.test.ts
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { idempotencyKey, notifySubmission } from "../functions/_shared/developmentNotify.ts";

const CONTEXT = {
  developmentName: "Harbor Point",
  developmentSlug: "harbor-point",
  unitLabel: "4B",
  agentName: "Test Agent",
  agentEmail: "agent@example.com",
  agentPhone: null,
  agentBrokerage: null,
  message: "Interested in 4B",
  submittedAt: "Mon, 01 Sep 2026 12:00:00 GMT",
};

const CONTACTS = [
  { id: "c1", name: "Sales Desk", email: "sales@dev.example", is_active: true, is_primary: true, receives_leads: true, receives_showing_requests: true },
  { id: "c2", name: "Second Desk", email: "second@dev.example", is_active: true, is_primary: false, receives_leads: true, receives_showing_requests: false },
];

export const RECIPIENTS = [
  { email: "sales@dev.example", name: "Sales Desk", identityKind: "contact", identityId: "c1" },
  { email: "second@dev.example", name: "Second Desk", identityKind: "contact", identityId: "c2" },
];

function fakeSupabase(opts: { existingKeys?: Set<string>; failKeys?: Set<string> } = {}) {
  const inserted: string[] = [];
  const stamped: string[] = [];
  const client: any = {
    inserted,
    stamped,
    auth: { admin: { getUserById: () => Promise.resolve({ data: null, error: "unused" }) } },
    rpc: () => Promise.resolve({ data: [], error: null }),
    from(table: string) {
      if (table === "email_jobs") {
        return {
          insert: (row: any) => {
            const key = row.idempotency_key;
            if (opts.failKeys?.has(key)) {
              return Promise.resolve({ error: { code: "XX000", message: "boom" } });
            }
            if (opts.existingKeys?.has(key)) {
              return Promise.resolve({ error: { code: "23505", message: "duplicate key" } });
            }
            inserted.push(key);
            return Promise.resolve({ error: null });
          },
        };
      }
      if (table === "development_sales_contacts") {
        const builder: any = {
          select: () => builder,
          eq: () => builder,
          then: (resolve: any) => resolve({ data: CONTACTS, error: null }),
        };
        return builder;
      }
      if (table === "development_leads" || table === "development_showing_requests") {
        return {
          update: () => ({
            eq: (_c: string, id: string) => ({
              is: () => {
                stamped.push(id);
                return Promise.resolve({ error: null });
              },
            }),
          }),
        };
      }
      const empty: any = {
        select: () => empty,
        eq: () => empty,
        then: (resolve: any) => resolve({ data: [], error: null }),
      };
      return empty;
    },
  };
  return client;
}

Deno.test("idempotency keys are per submission AND per recipient identity", () => {
  assertEquals(
    idempotencyKey("lead", "L1", RECIPIENTS[0] as never),
    "dev-lead:L1:contact:c1",
  );
  assertEquals(
    idempotencyKey("showing", "S1", { ...RECIPIENTS[1], identityKind: "owner", identityId: "u1" } as never),
    "dev-showing:S1:owner:u1",
  );
});

Deno.test("re-running the same submission never creates a second send", async () => {
  const client = fakeSupabase();
  const first = await notifySubmission(client, "lead", "L1", CONTEXT, "d1", "a1", CONTEXT.agentEmail);
  assertEquals(first.enqueued, 2);
  assert(first.notified);

  // Retry: both keys now exist -> unique violations counted as success, no new rows.
  const retryClient = fakeSupabase({
    existingKeys: new Set(["dev-lead:L1:contact:c1", "dev-lead:L1:contact:c2"]),
  });
  const second = await notifySubmission(retryClient, "lead", "L1", CONTEXT, "d1", "a1", CONTEXT.agentEmail);
  assertEquals(second.enqueued, 0);
  assertEquals(second.alreadyQueued, 2);
  assert(second.notified);
  assertEquals(retryClient.inserted.length, 0);
});

Deno.test("partial enqueue leaves notified_at unstamped and completes on retry", async () => {
  const failing = fakeSupabase({ failKeys: new Set(["dev-lead:L2:contact:c2"]) });
  const partial = await notifySubmission(failing, "lead", "L2", CONTEXT, "d1", "a1", CONTEXT.agentEmail);
  assertEquals(partial.enqueued, 1);
  assertEquals(partial.failed, 1);
  assertEquals(partial.notified, false);
  assertEquals(failing.stamped.length, 0);

  // Same-row retry: the already-enqueued recipient is skipped, the missing one lands.
  const retry = fakeSupabase({ existingKeys: new Set(["dev-lead:L2:contact:c1"]) });
  const done = await notifySubmission(retry, "lead", "L2", CONTEXT, "d1", "a1", CONTEXT.agentEmail);
  assertEquals(done.enqueued, 1);
  assertEquals(done.alreadyQueued, 1);
  assert(done.notified);
  assertEquals(retry.stamped, ["L2"]);
});
