/** Recipient selected for a share email (contact search or manual entry). */
export type ShareRecipient = {
  email: string;
  firstName: string;
  lastName?: string;
};

export function isValidShareRecipientEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/** Full name for chips and contact records. */
export function shareRecipientDisplayName(r: Pick<ShareRecipient, "firstName" | "lastName">): string {
  const first = r.firstName.trim();
  const last = r.lastName?.trim() ?? "";
  return [first, last].filter(Boolean).join(" ");
}

/** Greeting in share email templates (`Hi …`). */
export function shareRecipientGreetingName(r: ShareRecipient): string {
  return r.firstName.trim() || r.lastName?.trim() || "there";
}

export function shareRecipientFromParts(
  firstName: string,
  lastName: string,
  email: string,
): ShareRecipient | null {
  const first = firstName.trim();
  const trimmedEmail = email.trim();
  if (!first || !trimmedEmail || !isValidShareRecipientEmail(trimmedEmail)) return null;
  const last = lastName.trim();
  return {
    firstName: first,
    lastName: last || undefined,
    email: trimmedEmail,
  };
}
