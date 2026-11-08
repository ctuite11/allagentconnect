import { describe, expect, it } from "vitest";
import {
  isPublicReturnTo,
  resolvePostAuthRedirectWithMeta,
} from "@/lib/sharedListingGuest";

/**
 * AAC Concierge login CTA sends /auth?returnTo=%2Fconcierge.
 * Existing auth handles this destination for verified agents, admins,
 * and the public informational page for pending accounts.
 */
describe("AAC Concierge post-login destination", () => {
  it("accepts the concierge page as a safe same-origin destination", () => {
    const result = resolvePostAuthRedirectWithMeta(
      new URLSearchParams("returnTo=%2Fconcierge"),
    );
    expect(result.value).toBe("/concierge");
    expect(result.source).toBe("query");
  });

  it("allows pending agents back to the public concierge explanation", () => {
    expect(isPublicReturnTo("/concierge")).toBe(true);
  });

  it("rejects an external return URL", () => {
    const result = resolvePostAuthRedirectWithMeta(
      new URLSearchParams("returnTo=https%3A%2F%2Fexample.com"),
    );
    expect(result.value).toBeNull();
  });
});
