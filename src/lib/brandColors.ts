/**
 * AAC Brand Colors - Single Source of Truth
 * 
 * RULES:
 * - aacSuccess is ONLY for: verified/approved states, status dots, micro-accents
 * - aacSuccess is NOT for: primary CTAs, major headings, large backgrounds
 * - Use Tailwind classes when possible; fall back to these for inline styles
 */

export const AAC_BLUE = "#0E56F5";           // Royal Blue - brand primary
export const AAC_BLUE_HSL = "221 92% 51%";

export const AAC_SUCCESS = "#059669";        // Emerald-600 - verified/success
export const AAC_SUCCESS_HSL = "160 84% 39%";
export const AAC_SUCCESS_RGB = "5, 150, 105"; // For rgba() usage

// Pre-composed opacity variants for inline styles
export const aacSuccessGlow = (opacity: number) => 
  `rgba(5, 150, 105, ${opacity})`;

export const aacBlueGlow = (opacity: number) => 
  `rgba(14, 86, 245, ${opacity})`;
