import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  formatResendAudienceMessage,
  formatSentDateTime,
  friendlyResendCommsError,
  friendlyUpdateCommsError,
  previewSentMessage,
  RESEND_PAUSED_MESSAGE,
  sentCategoryLabel,
} from "./commsSentFormat";

describe("sentCategoryLabel", () => {
  it("labels known Communications categories", () => {
    expect(sentCategoryLabel("buyer_need")).toBe("Buyer Needs");
    expect(sentCategoryLabel("general_discussion")).toBe("General Discussions");
  });
});

describe("previewSentMessage", () => {
  it("returns short messages unchanged", () => {
    expect(previewSentMessage("Looking for a 3-bed in Brookline.")).toBe(
      "Looking for a 3-bed in Brookline.",
    );
  });

  it("truncates long messages", () => {
    const long = "word ".repeat(50);
    const preview = previewSentMessage(long, 40);
    expect(preview.endsWith("…")).toBe(true);
    expect(preview.length).toBeLessThanOrEqual(40);
  });
});

describe("formatSentDateTime", () => {
  it("returns empty for missing values", () => {
    expect(formatSentDateTime(null)).toBe("");
    expect(formatSentDateTime("not-a-date")).toBe("");
  });
});

describe("friendlyUpdateCommsError", () => {
  it("maps ownership, validation, and attachment errors", () => {
    expect(friendlyUpdateCommsError("You can only edit Communications you sent")).toBe(
      "You can only edit Communications you sent.",
    );
    expect(friendlyUpdateCommsError("Subject is required")).toBe("Please enter a subject.");
    expect(friendlyUpdateCommsError("Message is required")).toBe("Please enter a message.");
    expect(friendlyUpdateCommsError("at most 10 attachments are allowed")).toBe(
      "You can attach up to 10 photos or videos.",
    );
    expect(friendlyUpdateCommsError("attachment kind must be image or video")).toBe(
      "One of the attachments is invalid. Remove it and try again.",
    );
  });

  it("hides raw postgres text", () => {
    expect(friendlyUpdateCommsError("duplicate key value violates unique constraint")).toBe(
      "Couldn't save your changes. Please try again.",
    );
  });
});

describe("Sent Communications edit guard", () => {
  it("saves through update_comms_broadcast and never queues email", () => {
    const sent = readFileSync("src/lib/commsSent.ts", "utf8");
    const editor = readFileSync(
      "src/components/communication-center/EditSentCommunicationDialog.tsx",
      "utf8",
    );
    expect(sent).toContain('rpc("update_comms_broadcast"');
    expect(sent).not.toContain("send-client-need-notification");
    expect(sent).not.toContain("email_jobs");
    expect(editor).not.toContain("send-client-need-notification");
    expect(editor).toContain("Save changes");
  });

  it("Send Again confirms then calls resend-comms-broadcast with a session token", () => {
    const sent = readFileSync("src/lib/commsSent.ts", "utf8");
    const editor = readFileSync(
      "src/components/communication-center/EditSentCommunicationDialog.tsx",
      "utf8",
    );
    expect(editor).toContain("Cancel");
    expect(editor).toContain("Save changes");
    expect(editor).toContain("Send Again");
    expect(editor).toContain("This emails the original audience again.");
    expect(editor).toContain("Sent again");
    expect(editor).toContain("Already resent");
    expect(editor).toContain("crypto.randomUUID()");
    expect(sent).toContain('functions.invoke("resend-comms-broadcast"');
    expect(sent).toContain("broadcast_id:");
    expect(sent).toContain("resend_token:");
    expect(sent).toContain("duplicate_suppressed");
    expect(sent).toContain("paused");
    expect(sent).not.toContain("Updated message");
    expect(editor).not.toContain("send-client-need-notification");
  });
});

describe("formatResendAudienceMessage", () => {
  it("reports ineligible originals without treating that as failure", () => {
    expect(formatResendAudienceMessage(37, 3)).toBe(
      "Sent to 37 recipients; 3 no longer eligible.",
    );
    expect(formatResendAudienceMessage(12, 0)).toBeNull();
  });
});

describe("friendlyResendCommsError", () => {
  it("maps ownership and auth errors without raw postgres text", () => {
    expect(friendlyResendCommsError("You can only edit Communications you sent")).toBe(
      "You can only resend Communications you sent.",
    );
    expect(friendlyResendCommsError("Unauthorized")).toBe("Please sign in again.");
    expect(friendlyResendCommsError("duplicate key value violates unique constraint")).toBe(
      "Couldn't send this Communication again. Please try again.",
    );
  });
});

describe("resend paused copy", () => {
  it("explains that AAC was saved but no email went out", () => {
    expect(RESEND_PAUSED_MESSAGE).toBe(
      "Changes saved, but email sending is currently paused. No resend was sent.",
    );
  });
});
