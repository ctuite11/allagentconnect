/**
 * Formats a phone number to (XXX) XXX-XXXX format
 * Only formats 10-digit US numbers; returns original for all other lengths
 */
export const formatPhoneNumber = (phone: string | null | undefined): string => {
  if (!phone) return "";
  
  const phoneStr = String(phone).trim();
  if (!phoneStr) return "";
  
  // Remove all non-numeric characters
  const digits = phoneStr.replace(/\D/g, "");
  
  // Only format if exactly 10 digits
  if (digits.length === 10) {
    const area = digits.slice(0, 3);
    const mid = digits.slice(3, 6);
    const last = digits.slice(6);
    return `(${area}) ${mid}-${last}`;
  }
  
  // Fallback: return original input unchanged
  return phoneStr;
};
