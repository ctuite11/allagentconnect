/**
 * Formats a phone number to (XXX) XXX-XXXX format
 * Handles 10-digit and 11-digit (with leading 1) US numbers
 * Returns "—" for invalid/malformed numbers
 */
export const formatPhoneNumber = (phone: string | null | undefined): string => {
  if (!phone) return "";
  
  const phoneStr = String(phone).trim();
  if (!phoneStr) return "";
  
  // Remove all non-numeric characters
  let digits = phoneStr.replace(/\D/g, "");
  
  // Handle 11-digit numbers starting with 1 (US country code)
  if (digits.length === 11 && digits.startsWith("1")) {
    digits = digits.slice(1);
  }
  
  // Format if exactly 10 digits
  if (digits.length === 10) {
    const area = digits.slice(0, 3);
    const mid = digits.slice(3, 6);
    const last = digits.slice(6);
    return `(${area}) ${mid}-${last}`;
  }
  
  // Invalid length - return dash instead of garbage
  return "—";
};
