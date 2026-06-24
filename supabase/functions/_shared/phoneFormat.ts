/** Presentation-only U.S. phone formatting for transactional emails. */
export function formatUsPhoneForDisplay(phone: string | null | undefined): string {
  if (phone == null) return "";

  const original = String(phone).trim();
  if (!original) return "";

  const digits = original.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  return original;
}
