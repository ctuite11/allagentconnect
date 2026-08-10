import { describe, expect, it } from "vitest";
import { resolvePublicAgentPhones, toPublicAgentProfile } from "@/lib/publicListingModel";

describe("resolvePublicAgentPhones", () => {
  it("prefers cell for mobile and office_phone for office", () => {
    expect(
      resolvePublicAgentPhones({
        cell_phone: "617-555-0100",
        phone: "617-555-0101",
        office_phone: "617-555-0199",
      }),
    ).toEqual({
      mobile: "617-555-0100",
      office: "617-555-0199",
    });
  });

  it("falls back to phone when office_phone is missing", () => {
    expect(
      resolvePublicAgentPhones({
        cell_phone: "617-555-0100",
        phone: "617-555-0101",
        office_phone: null,
      }),
    ).toEqual({
      mobile: "617-555-0100",
      office: "617-555-0101",
    });
  });

  it("dedupes when office matches mobile", () => {
    expect(
      resolvePublicAgentPhones({
        cell_phone: "617-555-0100",
        phone: "617-555-0100",
        office_phone: "617-555-0100",
      }),
    ).toEqual({
      mobile: "617-555-0100",
      office: null,
    });
  });

  it("dedupes when office matches mobile ignoring formatting", () => {
    expect(
      resolvePublicAgentPhones({
        cell_phone: "(401) 864-9750",
        phone: "4018649750",
        office_phone: "401-864-9750",
      }),
    ).toEqual({
      mobile: "(401) 864-9750",
      office: null,
    });
  });
});

describe("toPublicAgentProfile", () => {
  it("maps agent_id onto id for existing agent card props", () => {
    const profile = toPublicAgentProfile({
      agent_id: "11111111-1111-1111-1111-111111111111",
      aac_id: "AAC-1",
      first_name: "Ada",
      last_name: "Agent",
      title: "Broker",
      company: "AAC Realty",
      office_name: "Boston",
      office_city: "Boston",
      office_state: "MA",
      headshot_url: null,
      logo_url: null,
      phone: "617-555-0101",
      office_phone: "617-555-0199",
      cell_phone: "617-555-0100",
      email: "ada@example.com",
    });

    expect(profile.id).toBe("11111111-1111-1111-1111-111111111111");
    expect(profile.email).toBe("ada@example.com");
    expect(profile.cell_phone).toBe("617-555-0100");
    expect(profile.office_phone).toBe("617-555-0199");
  });
});
