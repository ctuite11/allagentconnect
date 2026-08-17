import { describe, expect, it } from "vitest";
import {
  friendlyAdminRpcError,
  friendlyValidationMessages,
  parseSubmitDeveloperAccessResponse,
  validateDeveloperAccessForm,
} from "./developerAccessRequestForm";

describe("validateDeveloperAccessForm", () => {
  it("requires core contact fields", () => {
    expect(
      validateDeveloperAccessForm({
        first_name: "",
        last_name: "",
        email: "bad",
        phone: "123",
        company_name: "",
      }),
    ).toEqual([
      "First name is required.",
      "Last name is required.",
      "Please enter a valid work email.",
      "Please enter a valid phone number.",
      "Developer / Company name is required.",
    ]);
  });

  it("accepts a filled valid form", () => {
    expect(
      validateDeveloperAccessForm({
        first_name: "Ada",
        last_name: "Lovelace",
        email: "ada@example.com",
        phone: "3055551212",
        company_name: "Analytical Engines LLC",
      }),
    ).toEqual([]);
  });
});

describe("friendlyValidationMessages", () => {
  it("maps backend detail codes to friendly copy", () => {
    expect(
      friendlyValidationMessages([
        "first_name is required",
        "a valid work email is required",
        "website must be a valid URL",
      ]),
    ).toEqual([
      "First name is required.",
      "Please enter a valid work email.",
      "Please enter a valid website URL.",
    ]);
  });

  it("falls back for unknown details without exposing raw keys", () => {
    expect(friendlyValidationMessages(["weird_internal_code"])).toEqual([
      "Please review your submission and try again.",
    ]);
  });
});

describe("parseSubmitDeveloperAccessResponse", () => {
  it("treats success with duplicate false as success", async () => {
    await expect(
      parseSubmitDeveloperAccessResponse(
        { success: true, duplicate: false, request_id: "should-not-surface", message: "ok" },
        null,
      ),
    ).resolves.toEqual({ kind: "success" });
  });

  it("treats duplicate pending as friendly duplicate state", async () => {
    await expect(
      parseSubmitDeveloperAccessResponse(
        {
          success: true,
          duplicate: true,
          message: "We already have a pending request for this email. Our team will be in touch.",
        },
        null,
      ),
    ).resolves.toEqual({
      kind: "duplicate",
      message: "We already have a pending request for this email. Our team will be in touch.",
    });
  });

  it("maps validation failures", async () => {
    await expect(
      parseSubmitDeveloperAccessResponse(
        { error: "Validation failed", details: ["company_name is required"] },
        { context: new Response(null, { status: 400 }) },
      ),
    ).resolves.toEqual({
      kind: "validation",
      messages: ["Developer / Company name is required."],
    });
  });

  it("maps rate limits", async () => {
    await expect(
      parseSubmitDeveloperAccessResponse(
        { error: "Too many requests" },
        { context: new Response(null, { status: 429 }) },
      ),
    ).resolves.toEqual({ kind: "rate_limited" });
  });

  it("maps unexpected failures without technical detail", async () => {
    await expect(
      parseSubmitDeveloperAccessResponse(
        { error: "Failed to submit. Please try again." },
        { message: "Edge Function returned a non-2xx status code", context: new Response(null, { status: 500 }) },
      ),
    ).resolves.toEqual({ kind: "failure" });
  });
});

describe("friendlyAdminRpcError", () => {
  it("hides raw RPC exception text", () => {
    expect(friendlyAdminRpcError("admin role required")).toBe("You don't have permission to do that.");
    expect(friendlyAdminRpcError("request already approved")).toBe("This request was already approved.");
    expect(friendlyAdminRpcError("some cryptic postgres detail")).toBe(
      "Something went wrong. Please try again.",
    );
  });
});
