/**
 * PUBLIC, AGGREGATE-ONLY snapshot for the marketing website.
 * Data source: internal read-only aggregate count on 2026-11-06 of agent_settings:
 * agent_status = 'verified' AND account_activated_at IS NOT NULL
 * AND UPPER(license_state) = 'MA'.
 *
 * Static by design: no anonymous client query, no private membership data,
 * no implied real-time accuracy. Refresh only after another validated aggregate.
 */
export const verifiedMassachusettsAgentSnapshot = {
  count: 318,
  asOf: "2026-11-06",
  displayDate: "November 6, 2026",
} as const;

/**
 * Members must explicitly consent to public promotion of their name and face.
 * A member's visibility in the private agent directory is NOT such consent.
 * Add entries only after recording exact photo permission and accessible alt.
 */
export type PublicMemberPortrait = {
  id: string;
  imageSrc: string;
  publicAlt: string;
  consentRecordedAt: string;
};
export const approvedPublicMemberPortraits: PublicMemberPortrait[] = [];

/** Public founder media can be enabled once the owner approves the source. */
export const approvedFounderProfile: {
  imageSrc: string | null;
  linkedinUrl: string | null;
} = {
  imageSrc: null,
  linkedinUrl: null,
};
