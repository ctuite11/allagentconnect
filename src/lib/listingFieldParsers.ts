/**
 * Utilities for parsing and deduplicating raw MLS listing fields
 * (disclosures, broker comments, etc.) before rendering.
 */

/** Known field labels that appear in concatenated MLS strings */
const KNOWN_LABELS = [
  'Parking Comments',
  'Parking Features',
  'Garage Comments',
  'Seller Disclosure',
  'Disclosures',
  'Exclusions',
];

interface ParsedField {
  label: string;
  value: string;
}

/**
 * Parse a raw MLS blob like:
 *   "Parking Comments: one for sale $250,000, Parking Features: On Street Permit, ..."
 * into structured { label, value } pairs, deduplicated.
 */
export function parseDisclosureBlob(raw: string): ParsedField[] {
  if (!raw || !raw.trim()) return [];

  // Build regex to split on known labels
  const labelPattern = KNOWN_LABELS.map(l => l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const regex = new RegExp(`(${labelPattern})\\s*:\\s*`, 'gi');

  const fields: ParsedField[] = [];
  let match: RegExpExecArray | null;
  const positions: { label: string; start: number; valueStart: number }[] = [];

  while ((match = regex.exec(raw)) !== null) {
    positions.push({
      label: match[1],
      start: match.index,
      valueStart: match.index + match[0].length,
    });
  }

  for (let i = 0; i < positions.length; i++) {
    const valueEnd = i + 1 < positions.length ? positions[i + 1].start : raw.length;
    let value = raw.slice(positions[i].valueStart, valueEnd).trim();
    // Remove trailing comma/whitespace
    value = value.replace(/,\s*$/, '').trim();
    fields.push({ label: positions[i].label, value });
  }

  // Deduplicate by label+value (case-insensitive)
  const seen = new Set<string>();
  return fields.filter(f => {
    const key = `${f.label.toLowerCase()}::${f.value.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Parse disclosures which can be a string or string[].
 * Returns deduplicated structured fields.
 */
export function parseDisclosures(disclosures: any): ParsedField[] {
  if (!disclosures) return [];

  let raw: string;
  if (Array.isArray(disclosures)) {
    raw = disclosures.join(' ');
  } else if (typeof disclosures === 'string') {
    raw = disclosures;
  } else {
    return [];
  }

  return parseDisclosureBlob(raw);
}

/**
 * Check if a field value is effectively empty / "none".
 */
export function isEmptyValue(value: string | null | undefined): boolean {
  if (!value) return true;
  const normalized = value.trim().toLowerCase();
  return normalized === '' || normalized === 'none' || normalized === 'n/a' || normalized === 'na';
}

/**
 * Clean broker_comments: remove duplicated "Broker Comments: none" lines,
 * strip meta fields (Assessed Value, Fiscal Year, Floors) that belong elsewhere,
 * and return meaningful content or null.
 */
export function cleanBrokerComments(raw: string | null | undefined): string | null {
  if (!raw || !raw.trim()) return null;

  const lines = raw
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

  // Remove meta-fields that should be in other sections
  const metaPatterns = [
    /^assessed\s*value\s*:/i,
    /^fiscal\s*year\s*:/i,
    /^floors?\s*:/i,
  ];

  const seen = new Set<string>();
  const cleaned: string[] = [];

  for (const line of lines) {
    // Skip meta fields
    if (metaPatterns.some(p => p.test(line))) continue;

    // Deduplicate
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    // Skip "Broker Comments: none" type lines
    if (/^broker\s*comments?\s*:\s*none$/i.test(line)) continue;

    // Strip leading "Broker Comments:" prefix for cleanliness
    const stripped = line.replace(/^broker\s*comments?\s*:\s*/i, '').trim();
    if (stripped && !isEmptyValue(stripped)) {
      cleaned.push(stripped);
    }
  }

  return cleaned.length > 0 ? cleaned.join('\n') : null;
}
