import { formatPersonDisplayName } from "./personDisplayName.ts";

export function buildHotSheetInviteEmailSubject(inviterName: string): string {
  const name = formatPersonDisplayName(inviterName);
  return `${name} shared your hot sheet on All Agent Connect`;
}

export function buildHotSheetInvitePreheader(inviterName: string): string {
  return buildHotSheetInviteEmailSubject(inviterName);
}
