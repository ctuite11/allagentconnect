import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  classifyLegacyOnlyAgent,
  correctedAgentNetworkExclusionReason,
  passesCorrectedAgentNetworkRule,
  passesLegacyAgentNetworkRule,
} from "./agentNetworkEligibility.ts";

const baseActivated = {
  authUserExists: true,
  hasAgentRole: true,
  hasAgentProfile: true,
  agentStatus: "verified",
  accountActivatedAt: "2026-08-01T00:00:00Z",
  hideFromDirectory: false,
  firstName: "Ada",
  lastName: "Lovelace",
  company: "",
  headshotUrl: "",
};

Deno.test("verified + activated + no headshot is included", () => {
  assertEquals(
    passesCorrectedAgentNetworkRule({
      ...baseActivated,
      headshotUrl: null,
    }),
    true,
  );
  assertEquals(correctedAgentNetworkExclusionReason({ ...baseActivated, headshotUrl: "" }), null);
});

Deno.test("verified + activated + blank company is included", () => {
  assertEquals(
    passesCorrectedAgentNetworkRule({
      ...baseActivated,
      company: "   ",
    }),
    true,
  );
});

Deno.test("verified but unactivated + company populated is excluded", () => {
  const input = {
    ...baseActivated,
    accountActivatedAt: null,
    company: "Acme Realty",
  };
  assertEquals(passesLegacyAgentNetworkRule(input), true);
  assertEquals(passesCorrectedAgentNetworkRule(input), false);
  assertEquals(correctedAgentNetworkExclusionReason(input), "not_activated");
});

Deno.test("verified but unactivated + headshot populated is excluded", () => {
  const input = {
    ...baseActivated,
    accountActivatedAt: null,
    company: "",
    headshotUrl: "https://cdn.example/headshot.jpg",
  };
  // Headshot never counted as activation under legacy (company did) or corrected.
  assertEquals(passesLegacyAgentNetworkRule(input), false);
  assertEquals(passesCorrectedAgentNetworkRule(input), false);
  assertEquals(correctedAgentNetworkExclusionReason(input), "not_activated");
});

Deno.test("missing agent role is excluded", () => {
  const input = { ...baseActivated, hasAgentRole: false };
  assertEquals(passesCorrectedAgentNetworkRule(input), false);
  assertEquals(correctedAgentNetworkExclusionReason(input), "missing_agent_role");
});

Deno.test("missing auth user is excluded", () => {
  const input = { ...baseActivated, authUserExists: false };
  assertEquals(passesCorrectedAgentNetworkRule(input), false);
  assertEquals(correctedAgentNetworkExclusionReason(input), "missing_auth_user");
});

Deno.test("hidden agent is excluded", () => {
  const input = { ...baseActivated, hideFromDirectory: true };
  assertEquals(passesCorrectedAgentNetworkRule(input), false);
  assertEquals(correctedAgentNetworkExclusionReason(input), "hidden_from_directory");
});

Deno.test("missing or blank first/last name is excluded", () => {
  assertEquals(
    correctedAgentNetworkExclusionReason({ ...baseActivated, firstName: "  " }),
    "missing_or_blank_name",
  );
  assertEquals(
    correctedAgentNetworkExclusionReason({ ...baseActivated, lastName: null }),
    "missing_or_blank_name",
  );
});

Deno.test("approved team handling is unchanged (teams are not gated by these RPCs)", () => {
  // Teams are loaded separately via teams.status = 'approved' in OurAgents.
  // Individual RPC eligibility must not invent a team rule; assert individuals only.
  assertEquals(passesCorrectedAgentNetworkRule(baseActivated), true);
  assertEquals(
    passesCorrectedAgentNetworkRule({
      ...baseActivated,
      accountActivatedAt: null,
      company: "Team Brokerage Co",
    }),
    false,
  );
});

Deno.test("cleanup classification groups for legacy-only agents", () => {
  assertEquals(
    classifyLegacyOnlyAgent({
      ...baseActivated,
      accountActivatedAt: null,
      company: "Acme",
      encryptedPasswordPresent: true,
      lastSignInAt: null,
      matchedDeletedUsersArchive: false,
      emailLooksLikeTest: false,
    }),
    "password_setup_appears_complete_missing_activation",
  );

  assertEquals(
    classifyLegacyOnlyAgent({
      ...baseActivated,
      accountActivatedAt: null,
      company: "Acme",
      encryptedPasswordPresent: false,
      lastSignInAt: null,
      matchedDeletedUsersArchive: false,
      emailLooksLikeTest: false,
    }),
    "no_password_setup_evidence",
  );

  assertEquals(
    classifyLegacyOnlyAgent({
      ...baseActivated,
      accountActivatedAt: null,
      hasAgentRole: false,
      company: "Acme",
      encryptedPasswordPresent: false,
      lastSignInAt: null,
      matchedDeletedUsersArchive: false,
      emailLooksLikeTest: false,
    }),
    "missing_role_profile_settings_or_auth",
  );

  assertEquals(
    classifyLegacyOnlyAgent({
      ...baseActivated,
      accountActivatedAt: null,
      company: "Acme",
      encryptedPasswordPresent: false,
      lastSignInAt: null,
      matchedDeletedUsersArchive: true,
      emailLooksLikeTest: false,
    }),
    "duplicate_test_orphan_or_suspicious",
  );
});
