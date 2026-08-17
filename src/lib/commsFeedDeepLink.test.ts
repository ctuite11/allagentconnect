import { describe, it, expect } from "vitest";
import { buildCommsBroadcastPath, parseBroadcastParam, COMMS_FEED_PATH } from "./commsFeedDeepLink";

const ID = "3f6c1c2a-8f1b-4c8e-9b5a-1d2e3f4a5b6c";

describe("comms feed deep link", () => {
  it("parses a valid broadcast id, case-insensitively", () => {
    expect(parseBroadcastParam(ID)).toBe(ID);
    expect(parseBroadcastParam(ID.toUpperCase())).toBe(ID);
    expect(parseBroadcastParam(` ${ID} `)).toBe(ID);
  });

  it("rejects missing or malformed ids (feed keeps normal behavior)", () => {
    expect(parseBroadcastParam(null)).toBeNull();
    expect(parseBroadcastParam("")).toBeNull();
    expect(parseBroadcastParam("not-a-uuid")).toBeNull();
    expect(parseBroadcastParam("<script>")).toBeNull();
  });

  it("builds the deep-link path, falling back to the general feed", () => {
    expect(buildCommsBroadcastPath(ID)).toBe(`${COMMS_FEED_PATH}?broadcast=${ID}`);
    expect(buildCommsBroadcastPath(null)).toBe(COMMS_FEED_PATH);
    expect(buildCommsBroadcastPath("bogus")).toBe(COMMS_FEED_PATH);
  });
});
