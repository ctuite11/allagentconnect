/**
 * Formats a phone number to (XXX) XXX-XXXX format
 * Handles various input formats and returns formatted string
 */
export const formatPhoneNumber = (phone: string | null | undefined): string => {
  if (!phone) return "";
  
  // Convert to string if needed and trim
  const phoneStr = String(phone).trim();
  if (!phoneStr) return "";
  
  // Remove all non-numeric characters
  const cleaned = phoneStr.replace(/\D/g, "");
  
  // Don't format if no digits
  if (!cleaned) return phoneStr;
  
  // Format based on length
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  } else if (cleaned.length === 11 && cleaned[0] === "1") {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  } else if (cleaned.length > 10) {
    // Handle longer numbers with country codes
    const last10 = cleaned.slice(-10);
    const countryCode = cleaned.slice(0, -10);
    return `+${countryCode} (${last10.slice(0, 3)}) ${last10.slice(3, 6)}-${last10.slice(6)}`;
  }
  
  // Return original if it doesn't match expected formats
  return phoneStr;
};
