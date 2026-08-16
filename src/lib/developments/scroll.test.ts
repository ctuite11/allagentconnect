import { describe, expect, it } from "vitest";
import { parseDevelopmentHash } from "./scroll";

describe("development hash scroll helpers", () => {
  it("parses hash ids", () => {
    expect(parseDevelopmentHash("#amenities")).toBe("amenities");
    expect(parseDevelopmentHash("gallery")).toBe("gallery");
    expect(parseDevelopmentHash("#")).toBeNull();
    expect(parseDevelopmentHash("")).toBeNull();
    expect(parseDevelopmentHash(null)).toBeNull();
  });
});
