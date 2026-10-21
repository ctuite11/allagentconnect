import { describe, expect, it } from "vitest";
import { resolveCommsChannelBack } from "./commsChannelBack";

describe("resolveCommsChannelBack", () => {
  it("returns to Success Hub when the channel was opened from Success Hub", () => {
    expect(resolveCommsChannelBack("/agent-dashboard")).toEqual({
      path: "/agent-dashboard",
      label: "Back to Success Hub",
    });
  });

  it("falls back to Communications Center when no origin was passed", () => {
    expect(resolveCommsChannelBack(null)).toEqual({
      path: "/communications",
      label: "Communications Center",
    });
    expect(resolveCommsChannelBack(undefined)).toEqual({
      path: "/communications",
      label: "Communications Center",
    });
  });

  it("falls back to Communications Center for non-Success-Hub or unsafe origins", () => {
    expect(resolveCommsChannelBack("/agent/hot-sheets").path).toBe("/communications");
    expect(resolveCommsChannelBack("https://evil.example").path).toBe("/communications");
    expect(resolveCommsChannelBack("//evil.example").path).toBe("/communications");
  });
});
