/**
 * Formats a phone number to (XXX) XXX-XXXX format
 * Handles various input formats and returns formatted string
 */
export const formatPhoneNumber = (phone: string | null | undefined): string => {
  if (!phone) return "";
  
  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, "");
  
  // Format based on length
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  } else if (cleaned.length === 11 && cleaned[0] === "1") {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  
  // Return original if it doesn't match expected formats
  return phone;
};
