/**
 * Compact stable label for agent UI when no dedicated human-readable hot sheet code exists in DB.
 * Deterministic from UUID (same id → same label).
 */
export function formatHotSheetRef(hotSheetId: string): string {
  const hex = hotSheetId.replace(/-/g, "");
  let n = 0;
  for (let i = 0; i < hex.length; i++) {
    const v = parseInt(hex[i], 16);
    if (!Number.isNaN(v)) n = (n * 16 + v) >>> 0;
  }
  const code = 1000 + (n % 9000);
  return `HS-${code}`;
}
