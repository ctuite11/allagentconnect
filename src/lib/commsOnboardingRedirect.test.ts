import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  COMMS_ONBOARDING_PATH,
  isEligibleForCommsOnboardingRedirect,
  resolvePostAuthHomeRoute,
} from "./commsOnboardingRedirect";
import type { ResolvedRoleResult } from "./resolveUserRole";

const from = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => from(...args),
  },
}));

function verifiedAgentResolved(
  overrides: Partial<ResolvedRoleResult> = {},
): ResolvedRoleResult {
  return {
    role: "agent",
    is_verified_agent: true,
    can_access_success_hub: true,
    ...overrides,
  };
}

function mockAgentSettings(options: {
  read: { data: unknown; error: unknown };
  write?: { data: unknown; error: unknown };
}) {
  let phase: "read" | "write" = "read";
  const chain: {
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    is: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
  } = {
    select: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    update: vi.fn(),
    maybeSingle: vi.fn(),
  };

  chain.select.mockImplementation(() => chain);
  chain.eq.mockImplementation(() => chain);
  chain.is.mockImplementation(() => chain);
  chain.update.mockImplementation(() => {
    phase = "write";
    return chain;
  });
  chain.maybeSingle.mockImplementation(async () => {
    if (phase === "read") return options.read;
    return options.write ?? { data: null, error: null };
  });

  from.mockReturnValue(chain);
  return chain;
}

describe("isEligibleForCommsOnboardingRedirect", () => {
  it("includes never-configured agents who have never seen onboarding", () => {
    expect(
      isEligibleForCommsOnboardingRedirect({
        preferences_set: false,
        comms_onboarding_seen_at: null,
      }),
    ).toBe(true);
  });

  it("treats null preferences_set as eligible when seen_at is null", () => {
    expect(
      isEligibleForCommsOnboardingRedirect({
        preferences_set: null,
        comms_onboarding_seen_at: null,
      }),
    ).toBe(true);
  });

  it("excludes agents who already configured preferences", () => {
    expect(
      isEligibleForCommsOnboardingRedirect({
        preferences_set: true,
        comms_onboarding_seen_at: null,
      }),
    ).toBe(false);
  });

  it("excludes agents who already received the one-time redirect", () => {
    expect(
      isEligibleForCommsOnboardingRedirect({
        preferences_set: false,
        comms_onboarding_seen_at: "2026-08-12T12:00:00.000Z",
      }),
    ).toBe(false);
  });

  it("excludes when both preferences_set and seen_at are set", () => {
    expect(
      isEligibleForCommsOnboardingRedirect({
        preferences_set: true,
        comms_onboarding_seen_at: "2026-08-12T12:00:00.000Z",
      }),
    ).toBe(false);
  });
});

describe("resolvePostAuthHomeRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    from.mockReset();
  });

  it("lets valid returnTo win without touching agent_settings", async () => {
    const target = await resolvePostAuthHomeRoute({
      userId: "u1",
      resolved: verifiedAgentResolved(),
      returnTo: "/listings/abc",
    });
    expect(target).toBe("/listings/abc");
    expect(from).not.toHaveBeenCalled();
  });

  it("preserves non-agent homes", async () => {
    const target = await resolvePostAuthHomeRoute({
      userId: "u1",
      resolved: { role: "buyer", is_verified_agent: false, can_access_success_hub: false },
      returnTo: null,
    });
    expect(target).toBe("/client/dashboard");
    expect(from).not.toHaveBeenCalled();
  });

  it("preserves pending/unverified agent routing", async () => {
    const target = await resolvePostAuthHomeRoute({
      userId: "u1",
      resolved: verifiedAgentResolved({
        is_verified_agent: false,
        can_access_success_hub: false,
      }),
      returnTo: null,
    });
    expect(target).toBe("/pending-verification");
    expect(from).not.toHaveBeenCalled();
  });

  it("marks seen_at then redirects eligible verified agents to Comms", async () => {
    const chain = mockAgentSettings({
      read: {
        data: { preferences_set: false, comms_onboarding_seen_at: null },
        error: null,
      },
      write: { data: { user_id: "u1" }, error: null },
    });

    const target = await resolvePostAuthHomeRoute({
      userId: "u1",
      resolved: verifiedAgentResolved(),
      returnTo: null,
    });

    expect(target).toBe(COMMS_ONBOARDING_PATH);
    expect(from).toHaveBeenCalledWith("agent_settings");
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ comms_onboarding_seen_at: expect.any(String) }),
    );
    expect(chain.is).toHaveBeenCalledWith("comms_onboarding_seen_at", null);
  });

  it("keeps normal home when preferences_set is true", async () => {
    const chain = mockAgentSettings({
      read: {
        data: { preferences_set: true, comms_onboarding_seen_at: null },
        error: null,
      },
    });

    const target = await resolvePostAuthHomeRoute({
      userId: "u1",
      resolved: verifiedAgentResolved(),
      returnTo: null,
    });

    expect(target).toBe("/agent-dashboard");
    expect(chain.update).not.toHaveBeenCalled();
  });

  it("keeps normal home when seen_at is already set", async () => {
    const chain = mockAgentSettings({
      read: {
        data: {
          preferences_set: false,
          comms_onboarding_seen_at: "2026-08-12T12:00:00.000Z",
        },
        error: null,
      },
    });

    const target = await resolvePostAuthHomeRoute({
      userId: "u1",
      resolved: verifiedAgentResolved(),
      returnTo: null,
    });

    expect(target).toBe("/agent-dashboard");
    expect(chain.update).not.toHaveBeenCalled();
  });

  it("does not redirect when mark-seen update fails", async () => {
    mockAgentSettings({
      read: {
        data: { preferences_set: false, comms_onboarding_seen_at: null },
        error: null,
      },
      write: { data: null, error: { message: "rls" } },
    });

    const target = await resolvePostAuthHomeRoute({
      userId: "u1",
      resolved: verifiedAgentResolved(),
      returnTo: null,
    });

    expect(target).toBe("/agent-dashboard");
  });

  it("does not redirect when mark-seen updates zero rows", async () => {
    mockAgentSettings({
      read: {
        data: { preferences_set: false, comms_onboarding_seen_at: null },
        error: null,
      },
      write: { data: null, error: null },
    });

    const target = await resolvePostAuthHomeRoute({
      userId: "u1",
      resolved: verifiedAgentResolved(),
      returnTo: null,
    });

    expect(target).toBe("/agent-dashboard");
  });
});
