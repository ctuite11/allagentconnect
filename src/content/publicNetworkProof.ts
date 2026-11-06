/**
 * Public aggregate snapshot supplied by the AAC founder on November 6, 2026:
 * 347 active platform members. This is NOT the same as the narrower database
 * query for verified/activated members with a Massachusetts license state
 * (318 on the same date). Avoid mislabeling this total as MA-verified agents.
 *
 * No anonymous database query, member profiles, or live count endpoint.
 * Reconfirm and update this number before representing it as current later.
 * Facebook-group participation is separate and is not included in this count.
 */
export const activeAACMemberSnapshot = {
  count: 347,
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
