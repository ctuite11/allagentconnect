import { describe, it, expect, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import {
  DEFAULT_HOT_SHEET_STATUSES,
  HOT_SHEET_FILTER_STATUSES,
  isBuyerConnected,
  isFirstInviteEligible,
  getFirstBatchCta,
  FIRST_BATCH_CTA,
} from "./hotSheetRules";
import { OTHER_MEMBER_EMAIL_MESSAGE, isOtherMemberEmailError } from "./agentContactResolver";

const statusValue = (s: unknown) =>
  typeof s === "string" ? s : (s as { value: string }).value;

describe("LOCKED: Hot Sheet status defaults", () => {
  it("defaults are exactly Coming Soon + Off Market", () => {
    expect([...DEFAULT_HOT_SHEET_STATUSES].sort()).toEqual(["coming_soon", "off_market"]);
  });
  it("Coming Soon and Off Market are first in the list, once each", () => {
    const values = HOT_SHEET_FILTER_STATUSES.map(statusValue);
    expect(values.slice(0, 2)).toEqual(["coming_soon", "off_market"]);
    expect(values.filter((v) => v === "coming_soon")).toHaveLength(1);
    expect(values.filter((v) => v === "off_market")).toHaveLength(1);
  });
  it("ACT and Back on Market are not defaults", () => {
    expect(DEFAULT_HOT_SHEET_STATUSES).not.toContain("active");
    expect(DEFAULT_HOT_SHEET_STATUSES).not.toContain("back_on_market");
  });
});

describe("LOCKED: connected buyer = active relationship only", () => {
  it("active, linked, not ended → connected", () => {
    expect(isBuyerConnected({ status: "active", client_id: "u1", ended_at: null })).toBe(true);
  });
  it("ended relationship → not connected", () => {
    expect(isBuyerConnected({ status: "active", client_id: "u1", ended_at: "2026-01-01" })).toBe(false);
  });
  it("pending or no buyer account → not connected", () => {
    expect(isBuyerConnected({ status: "pending", client_id: "u1" })).toBe(false);
    expect(isBuyerConnected({ status: "active", client_id: null })).toBe(false);
  });
  it("no relationship (accepted invite alone) → not connected", () => {
    expect(isBuyerConnected(null)).toBe(false);
    expect(isBuyerConnected(undefined)).toBe(false);
  });
});

describe("LOCKED: first invite eligibility", () => {
  it("pending buyer with no live invite → first invite due", () => {
    expect(isFirstInviteEligible(false, 0)).toBe(true);
  });
  it("connected buyer → no invite", () => {
    expect(isFirstInviteEligible(true, 0)).toBe(false);
  });
  it("live invite exists → no new first invite", () => {
    expect(isFirstInviteEligible(false, 1)).toBe(false);
  });
});

describe("LOCKED: Send button label", () => {
  it("pending buyer sees Send First Batch & Invite", () => {
    expect(getFirstBatchCta({ hasPendingInviteRecipients: true, allFirstBatchQueued: false })).toBe(
      "Send First Batch & Invite",
    );
    expect(getFirstBatchCta({ hasPendingInviteRecipients: true, allFirstBatchQueued: true })).toBe(
      FIRST_BATCH_CTA.pendingInvite,
    );
  });
  it("connected buyer sees Send First Batch", () => {
    expect(getFirstBatchCta({ hasPendingInviteRecipients: false, allFirstBatchQueued: false })).toBe(
      "Send First Batch",
    );
  });
  it("already-sent sheet sees Send Selected Matches", () => {
    expect(getFirstBatchCta({ hasPendingInviteRecipients: false, allFirstBatchQueued: true })).toBe(
      "Send Selected Matches",
    );
  });
});

describe("LOCKED: duplicate email message", () => {
  it("uses the exact required wording", () => {
    expect(OTHER_MEMBER_EMAIL_MESSAGE).toBe(
      "This email is associated with another member and cannot be added.",
    );
  });
  it("recognizes the server error", () => {
    expect(isOtherMemberEmailError({ message: OTHER_MEMBER_EMAIL_MESSAGE })).toBe(true);
    expect(isOtherMemberEmailError({ message: "other" })).toBe(false);
  });
});
