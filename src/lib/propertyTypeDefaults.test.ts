import { describe, it, expect } from "vitest";
import { resolveCommsPropertyTypes } from "./propertyTypeDefaults";

describe("Communications Center property type default", () => {
  it("unconfigured agent starts with exactly Single Family + Condominium", () => {
    for (const v of [undefined, null, [], {}]) {
      expect(resolveCommsPropertyTypes(v)).toEqual(["single_family", "condo"]);
    }
  });
  it("saved preferences are kept", () => {
    const all8 = ["single_family","condo","townhouse","multi_family","land","commercial","residential_rental","commercial_rental"];
    expect(resolveCommsPropertyTypes(all8)).toEqual(all8);
    expect(resolveCommsPropertyTypes(["land"])).toEqual(["land"]);
  });
});
