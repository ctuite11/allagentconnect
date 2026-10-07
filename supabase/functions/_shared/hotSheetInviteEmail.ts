export function buildHotSheetInviteEmailSubject(_inviterName?: string): string {
  return "You’ve been invited to a Hot Sheet on All Agent Connect";
}

export function buildHotSheetInvitePreheader(_inviterName?: string): string {
  return buildHotSheetInviteEmailSubject(_inviterName);
}
