/**
 * Display-name initials helper.
 * - Single word: first two characters, uppercased.
 * - Multi-word: first letter of first + last word, uppercased.
 * - Empty / unknown: "?".
 */
export function initialsFromDisplayName(name: string): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}