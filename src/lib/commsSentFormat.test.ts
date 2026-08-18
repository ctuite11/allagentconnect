import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  formatSentDateTime,
  friendlyUpdateCommsError,
  previewSentMessage,
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
});
