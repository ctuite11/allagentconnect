import { describe, it, expect, beforeEach } from "vitest";
import {
  detectRecoveryLanding,
  recordBootRecoveryLanding,
  getBootRecoveryLanding,
  resolvePostAuthLanding,
} from "./authRecoveryLanding";
import { clearRecoveryState } from "./authRecovery";

const RECOVERY_HASH = "#access_token=a&refresh_token=r&expires_in=3600&type=recovery";

describe("recovery link landing", () => {
  beforeEach(() => clearRecoveryState());

  it("valid recovery link (tokens + type=recovery) is captured", () => {
    expect(detectRecoveryLanding(RECOVERY_HASH, "")).toEqual({ isRecovery: true, isSetup: false });
  });

  it("valid recovery link reaches the reset form even after the hash is stripped", () => {
    recordBootRecoveryLanding(RECOVERY_HASH, "");
    expect(
      resolvePostAuthLanding({
        hasSession: true,
        urlRecovery: false,
        bootRecovery: getBootRecoveryLanding().isRecovery,
        setupActive: false,
      }),
    ).toBe("password-reset");
  });

  it("expired/invalid link (no session) never shows the reset form", () => {
    expect(
      resolvePostAuthLanding({ hasSession: false, urlRecovery: true, bootRecovery: true, setupActive: false }),
    ).toBe("normal");
  });

  it("a URL parameter alone is never proof of recovery", () => {
    expect(detectRecoveryLanding("", "?type=recovery").isRecovery).toBe(false);
    expect(detectRecoveryLanding("#type=recovery", "").isRecovery).toBe(false);
  });

  it("normal magic-link sign-in is not a recovery", () => {
    expect(
      detectRecoveryLanding("#access_token=a&refresh_token=r&type=magiclink", "").isRecovery,
    ).toBe(false);
  });

  it("already-authenticated user with no recovery link goes to normal routing", () => {
    recordBootRecoveryLanding("", "");
    expect(
      resolvePostAuthLanding({ hasSession: true, urlRecovery: false, bootRecovery: false, setupActive: false }),
    ).toBe("normal");
  });

  it("capture is cleared after password update / deliberate sign-in", () => {
    recordBootRecoveryLanding(RECOVERY_HASH, "");
    clearRecoveryState();
    expect(getBootRecoveryLanding().isRecovery).toBe(false);
  });

  it("License Verified setup link still goes to agent setup", () => {
    const l = detectRecoveryLanding(RECOVERY_HASH, "?setup=1");
    expect(l).toEqual({ isRecovery: true, isSetup: true });
    expect(
      resolvePostAuthLanding({ hasSession: true, urlRecovery: true, bootRecovery: true, setupActive: l.isSetup }),
    ).toBe("agent-setup");
  });

  it("admin-issued reset lands on the same recovery callback", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("src/pages/AdminApprovals.tsx", "utf8");
    expect(src).toContain("redirectUrl: `${window.location.origin}/auth/callback`");
    expect(src).not.toContain("/auth?mode=reset");
  });

  it("password reset page does not activate or verify the account", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("src/pages/PasswordReset.tsx", "utf8");
    expect(src).not.toContain("mark_agent_activated\",");
    expect(src).not.toMatch(/rpc\("mark_agent_activated"/);
  });
});
