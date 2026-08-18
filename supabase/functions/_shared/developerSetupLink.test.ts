import { assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import {
  DEVELOPER_SETUP_SUBJECT,
  DEVELOPER_SETUP_TEMPLATE,
  describeIssuanceFailure,
  developerSetupPayload,
  issueDeveloperSetupLink,
} from "./developerSetupLink.ts";

const SECRET = "test-secret";

interface StubOptions {
  deletion?: unknown;
  issuance?: Record<string, unknown>;
}

function stubAdmin(opts: StubOptions = {}) {
  const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  const updates: Array<Record<string, unknown>> = [];
  const admin = {
    // deno-lint-ignore no-explicit-any
    rpc(fn: string, args: Record<string, unknown>): any {
      calls.push({ fn, args });
      if (fn === "find_current_agent_deletion") {
        return Promise.resolve({ data: opts.deletion ?? null, error: null });
      }
      return Promise.resolve({
        data: opts.issuance ?? {
          status: "created",
          job_id: "job-1",
          token_id: "tok-1",
        },
        error: null,
      });
    },
    from() {
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: () =>
          Promise.resolve({ data: { payload: { to: "dev@example.com" } } }),
        update: (values: Record<string, unknown>) => {
          updates.push(values);
          return { eq: () => Promise.resolve({ error: null }) };
        },
      };
      return chain;
    },
  };
  return { admin, calls, updates };
}

const baseInput = (admin: unknown) => ({
  admin,
  supabaseUrl: "http://localhost",
  serviceKey: "service",
  secret: SECRET,
  userId: "11111111-1111-4111-8111-111111111111",
  email: "dev@example.com",
  firstName: "Dana",
});

Deno.test({
  name: "eligible developer gets a queued setup link with developer wording",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const { admin, calls, updates } = stubAdmin();
    const result = await issueDeveloperSetupLink(baseInput(admin));

    assertEquals(result.status, "queued");
    const issuance = calls.find(
      (c) => c.fn === "reissue_agent_activation_token",
    );
    assertEquals(issuance?.args.p_subject, DEVELOPER_SETUP_SUBJECT);
    assertEquals(issuance?.args.p_allow_previously_deleted, false);
    assertEquals(updates[0].payload, {
      to: "dev@example.com",
      template: DEVELOPER_SETUP_TEMPLATE,
      subject: DEVELOPER_SETUP_SUBJECT,
      reply_to: "chris@allagentconnect.com",
      first_name: "Dana",
    });
  },
});

Deno.test({
  name: "a deletion tombstone stops the send and asks for acknowledgement",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const { admin, calls } = stubAdmin({
      deletion: { id: "d1", email: "dev@example.com" },
    });
    const result = await issueDeveloperSetupLink(baseInput(admin));

    assertEquals(result.status, "previously_deleted");
    assertEquals(
      calls.some((c) => c.fn === "reissue_agent_activation_token"),
      false,
    );
  },
});

Deno.test({
  name: "acknowledged deletion issues a fresh token and passes the override through",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const { admin, calls } = stubAdmin({ deletion: { id: "d1" } });
    const result = await issueDeveloperSetupLink({
      ...baseInput(admin),
      acknowledgeDeleted: true,
    });

    assertEquals(result.status, "queued");
    const issuance = calls.find(
      (c) => c.fn === "reissue_agent_activation_token",
    );
    assertEquals(issuance?.args.p_allow_previously_deleted, true);
    // The tombstone lookup is skipped entirely once acknowledged.
    assertEquals(
      calls.some((c) => c.fn === "find_current_agent_deletion"),
      false,
    );
  },
});

Deno.test({
  name: "an ineligible user reports a readable failure, not a success",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const { admin } = stubAdmin({ issuance: { status: "ineligible" } });
    const result = await issueDeveloperSetupLink(baseInput(admin));

    assertEquals(result.status, "failed");
    assertEquals(
      result.status === "failed" ? result.reason : "",
      describeIssuanceFailure("ineligible"),
    );
  },
});

Deno.test({
  name: "a deduped issuance is reported without re-patching the payload",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const { admin, updates } = stubAdmin({
      issuance: { status: "deduped", job_id: "job-9", token_id: "tok-9" },
    });
    const result = await issueDeveloperSetupLink(baseInput(admin));

    assertEquals(result.status, "deduped");
    assertEquals(updates.length, 0);
  },
});

Deno.test({
  name: "missing signing secret fails closed",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const { admin, calls } = stubAdmin();
    const result = await issueDeveloperSetupLink({
      ...baseInput(admin),
      secret: undefined,
    });

    assertEquals(result.status, "failed");
    assertEquals(calls.length, 0);
  },
});

Deno.test({
  name: "developerSetupPayload preserves the queue-owned activation fields",
  sanitizeOps: false,
  sanitizeResources: false,
  fn() {
    const out = developerSetupPayload(
      { to: "dev@example.com", activation_token_id: "tok", provider: "resend" },
      null,
    );
    assertEquals(out.activation_token_id, "tok");
    assertEquals(out.provider, "resend");
    assertEquals(out.first_name, null);
  },
});
