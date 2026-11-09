/**
 * Add only agent testimonials whose wording, identity, brokerage, location,
 * outcome and permission to appear publicly have been verified by AAC.
 * Never load private network data into a public testimonial component.
 */
export type ApprovedAgentStory = {
  quote: string;
  name: string;
  brokerage: string;
  city: string;
  outcome: string;
  consentRecordedAt: string;
};

export const approvedAgentStories: ApprovedAgentStory[] = [];
