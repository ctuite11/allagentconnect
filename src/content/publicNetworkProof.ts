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
