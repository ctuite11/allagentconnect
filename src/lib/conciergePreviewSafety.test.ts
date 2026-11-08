import { describe, expect, it } from "vitest";
import { isConciergeNoSendPreviewHost } from "./conciergePreviewSafety";

describe("Concierge preview no-send safety", () => {
  it("blocks the actual PR 107 Netlify preview", () => {
    expect(isConciergeNoSendPreviewHost("deploy-preview-107--splendid-gaufre-49195f.netlify.app")).toBe(true);
  });
  it("blocks other deploy-preview numbers and hostnames", () => {
    expect(isConciergeNoSendPreviewHost("deploy-preview-12--aac-test.netlify.app")).toBe(true);
  });
  it("does not disable a real production or isolated staging domain", () => {
    expect(isConciergeNoSendPreviewHost("allagentconnect.com")).toBe(false);
    expect(isConciergeNoSendPreviewHost("staging.allagentconnect.com")).toBe(false);
    expect(isConciergeNoSendPreviewHost("splendid-gaufre-49195f.netlify.app")).toBe(false);
  });
  it("rejects lookalike or attacker-supplied hostnames", () => {
    expect(isConciergeNoSendPreviewHost("deploy-preview-107--aac.netlify.app.evil.example")).toBe(false);
    expect(isConciergeNoSendPreviewHost("evil-deploy-preview-107--aac.netlify.app")).toBe(false);
    expect(isConciergeNoSendPreviewHost("deploy-preview-107--aac.netlify.app:443")).toBe(false);
  });
});
