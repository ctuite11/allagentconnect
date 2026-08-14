// DRAFT 2 — not deployed. On apply, move to
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

function fakeSupabase(opts: { existingKeys?: Set<string>; failKeys?: Set<string> } = {}) {
  const inserted: string[] = [];
  const stamped: string[] = [];
  return {
    inserted,
    stamped,
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
      return {
        update: () => ({
          eq: (_c: string, id: string) => ({
            is: () => {
              stamped.push(id);
              return Promise.resolve({ error: null });
            },
          }),
        }),
        select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }) }),
      };
    },
  } as any;
}

const RECIPIENTS = [
  { email: "sales@dev.example", name: "Sales Desk", identityKind: "contact", identityId: "c1" },
  { email: "owner@dev.example", name: "Owner", identityKind: "owner", identityId: "u1" },
];

// resolveDevelopmentRecipients is exercised separately; here we stub the DB reads it makes.
function withRecipients(client: any) {
  client.rpc = (fn: string) =>
    fn === "resolve_development_recipients"
      ? Promise.resolve({ data: RECIPIENTS, error: null })
      : Promise.resolve({ data: [], error: null });
  return client;
}

Deno.test("idempotency keys are per submission AND per recipient identity", () => {
  assertEquals(
    idempotencyKey("lead", "L1", RECIPIENTS[0] as never),
    "dev-lead:L1:contact:c1",
  );
  assertEquals(
    idempotencyKey("showing", "S1", RECIPIENTS[1] as never),
    "dev-showing:S1:owner:u1",
  );
});

Deno.test("re-running the same submission never creates a second send", async () => {
  const client = withRecipients(fakeSupabase());
  const first = await notifySubmission(client, "lead", "L1", CONTEXT, "d1", "a1", CONTEXT.agentEmail);
  assertEquals(first.enqueued, 2);
  assert(first.notified);

  // Retry: both keys now exist -> unique violations counted as success, no new rows.
  const retryClient = withRecipients(
    fakeSupabase({ existingKeys: new Set(["dev-lead:L1:contact:c1", "dev-lead:L1:owner:u1"]) }),
  );
  const second = await notifySubmission(retryClient, "lead", "L1", CONTEXT, "d1", "a1", CONTEXT.agentEmail);
  assertEquals(second.enqueued, 0);
  assertEquals(second.alreadyQueued, 2);
  assert(second.notified);
  assertEquals(retryClient.inserted.length, 0);
});

Deno.test("partial enqueue leaves notified_at unstamped and completes on retry", async () => {
  const failing = withRecipients(fakeSupabase({ failKeys: new Set(["dev-lead:L2:owner:u1"]) }));
  const partial = await notifySubmission(failing, "lead", "L2", CONTEXT, "d1", "a1", CONTEXT.agentEmail);
  assertEquals(partial.enqueued, 1);
  assertEquals(partial.failed, 1);
  assertEquals(partial.notified, false);
  assertEquals(failing.stamped.length, 0);

  // Same-row retry: the already-enqueued recipient is skipped, the missing one lands.
  const retry = withRecipients(fakeSupabase({ existingKeys: new Set(["dev-lead:L2:contact:c1"]) }));
  const done = await notifySubmission(retry, "lead", "L2", CONTEXT, "d1", "a1", CONTEXT.agentEmail);
  assertEquals(done.enqueued, 1);
  assertEquals(done.alreadyQueued, 1);
  assert(done.notified);
  assertEquals(retry.stamped, ["L2"]);
});
