import { describe, expect, it } from "vitest";
import {
  interpretRequestAccessResponse,
  requestAccessFailure,
  RETRY_MESSAGES,
} from "./requestAccessOutcome";

describe("Request Access outcome", () => {
  it("confirms only when the server says the request was submitted", () => {
    expect(interpretRequestAccessResponse({ ok: true, code: "submitted" }).kind).toBe("received");
  });

  it("treats a repeat submission as received without creating a new request", () => {
    const outcome = interpretRequestAccessResponse({ ok: true, code: "already_pending" });
    expect(outcome).toMatchObject({ kind: "received", alreadyOnFile: true });
  });

  it("never confirms on a timeout", () => {
    expect(requestAccessFailure("timeout")).toEqual({ kind: "error", message: RETRY_MESSAGES.timeout });
  });

  it("never confirms when the network request fails", () => {
    expect(requestAccessFailure("network").kind).toBe("error");
  });

  it("never confirms on an unexpected or empty server response", () => {
    expect(interpretRequestAccessResponse({ code: "insert_failed" }).kind).toBe("error");
    expect(interpretRequestAccessResponse(null).kind).toBe("error");
    expect(interpretRequestAccessResponse({ ok: true }).kind).toBe("error");
  });

  it("shows the server's validation message for a rejected submission", () => {
    expect(
      interpretRequestAccessResponse({ code: "validation_failed", errors: ["Enter a valid license number"] }),
    ).toEqual({ kind: "error", message: "Enter a valid license number" });
  });

  it("routes an existing account to sign in", () => {
    expect(interpretRequestAccessResponse({ ok: false, code: "account_exists" }).kind).toBe("account_exists");
  });
});
