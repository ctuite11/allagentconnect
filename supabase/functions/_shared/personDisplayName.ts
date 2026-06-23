function titleCaseToken(term: string): string {
  const t = term.trim();
  if (!t) return "";
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

/** Title-case each name part so `kerri brooks` → `Kerri Brooks`. */
export function formatPersonDisplayName(raw: string, fallback = "Your agent"): string {
  const formatted = raw
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(titleCaseToken)
    .join(" ");
  return formatted || fallback;
}
