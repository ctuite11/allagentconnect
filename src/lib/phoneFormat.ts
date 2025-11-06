/**
 * Formats a phone number to (XXX) XXX-XXXX format
 * Handles various input formats and returns formatted string
 */
export const formatPhoneNumber = (phone: string | null | undefined): string => {
  if (!phone) return "";
  
  // Convert to string if needed and trim
  const phoneStr = String(phone).trim();
  if (!phoneStr) return "";
  
  // Extract and remove extension if present (e.g., x123, ext 123)
  const extMatch = phoneStr.match(/(?:ext\.?|x)\s*(\d+)$/i);
  const baseStr = phoneStr.replace(/(?:ext\.?|x)\s*\d+$/i, "").trim();

  // Remove all non-numeric characters from base
  const cleaned = baseStr.replace(/\D/g, "");
  
  // Don't format if no digits
  if (!cleaned) return phoneStr;
  
  let formatted = baseStr;

  // Format based on length
  if (cleaned.length === 10) {
    formatted = `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  } else if (cleaned.length === 11 && cleaned[0] === "1") {
    formatted = `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  } else if (cleaned.length > 11 && cleaned[0] === "1") {
    // If longer but starts with country code 1, take the next 10 as the main number
    const last10 = cleaned.slice(-10);
    formatted = `+1 (${last10.slice(0, 3)}) ${last10.slice(3, 6)}-${last10.slice(6)}`;
  } else if (cleaned.length > 10) {
    // Handle other country codes by splitting country code and last 10 digits
    const last10 = cleaned.slice(-10);
    const countryCode = cleaned.slice(0, -10);
    formatted = `+${countryCode} (${last10.slice(0, 3)}) ${last10.slice(3, 6)}-${last10.slice(6)}`;
  }
  
  // Append extension back if present
  if (extMatch && extMatch[1]) {
    formatted = `${formatted} x${extMatch[1]}`;
  }
  
  // Return formatted or original if it doesn't match expected formats
  return formatted || phoneStr;
};
