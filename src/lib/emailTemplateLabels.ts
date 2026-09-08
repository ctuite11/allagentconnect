/**
 * Friendly display names for email_jobs template keys.
 * Keys come from `payload->>template` on email_jobs.
 * Unknown keys fall back to a readable title-cased version of the raw key.
 */
export const EMAIL_TEMPLATE_LABELS: Record<string, string> = {
  "license-verified": "License Verified",
  "admin-created-invite": "Invitation",
  "agent-invite": "Invitation",
  "agent-forward-invite": "Forwardable Invite",
  "personal-forward-invite": "Personal Invite",
  "founder-invite-1to1": "Founder Invite",
  "agent-missing-opportunities": "Don't miss opportunities",
  "agent-activation-nudge": "Activation Nudge",
  "agent-temp-password": "Temporary password",
  "agent-login-link": "Login Link",
  "agent-verification-submitted": "Verification Submitted",
  "agent-approval-accepted": "Approval Accepted",
  "agent-account-removed": "Account Removed",
  "agent-new-listing-alert": "New Listing Alert",
  "agent-profile-contact": "Profile Contact",
  "agent-client-email": "Client Email",
  "account-delegate-invite": "Delegate Invite",
  "admin-adhoc": "Manual Admin Email",
  "bulk-email": "Bulk Email",
  "bulk-listing-share": "Bulk Listing Share",
  "buyer-workspace-invite": "Buyer Workspace Invite",
  "client-agent-message": "Client Message",
  "client-need-broadcast": "Buyer Need Broadcast",
  "client-need-notification": "Buyer Need Notification",
  "comms-center-guide": "Comms Center Guide",
  "comms-digest": "Comms Digest",
  "hot-sheet-agent-reply": "Hot Sheet Reply",
  "hot-sheet-alert": "Hot Sheet Alert",
  "hot-sheet-comment": "Hot Sheet Comment",
  "hot-sheet-invite": "Hot Sheet Invite",
  "hot-sheet-preview-blast": "Hot Sheet Preview",
  "hot-sheet-preview-blast-test": "Hot Sheet Preview (Test)",
  "hot-sheet-status-change": "Hot Sheet Status Change",
  "listing-contact-inquiry": "Listing Inquiry",
  "listing-share": "Listing Share",
  "new-match-notification": "New Match",
  "new-message-notification": "New Message",
  "price-change-notification": "Price Change",
  "reverse-prospecting": "Reverse Prospecting",
  "showing-request": "Showing Request",
  "stale-listing-reminder": "Stale Listing Reminder",
  "team-approved": "Team Approved",
  "team-request-notification": "Team Request",
};

export function emailTemplateLabel(template?: string | null): string {
  if (!template) return "Email";
  return EMAIL_TEMPLATE_LABELS[template] ?? template;
}

export function relativeDayAge(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export function lastEmailTooltip(info: {
  sent_at: string;
  template?: string | null;
  status?: string | null;
}): string {
  return [
    new Date(info.sent_at).toLocaleString(),
    `Status: ${info.status ?? "unknown"}`,
    `Template: ${info.template ?? "unknown"}`,
  ].join("\n");
}
