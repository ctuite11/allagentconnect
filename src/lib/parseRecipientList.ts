export const MAX_RECIPIENTS = 50;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ParsedRecipients = {
  valid: string[];
  invalid: string[];
  tooMany: boolean;
};

/** Split a comma/semicolon/whitespace-separated list, lowercase, dedupe, validate. */
export function parseRecipientList(input: string): ParsedRecipients {
  const seen = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const raw of input.split(/[,;\s]+/)) {
    const e = raw.trim().toLowerCase();
    if (!e || seen.has(e)) continue;
    seen.add(e);
    (EMAIL_RE.test(e) ? valid : invalid).push(e);
  }
  return { valid, invalid, tooMany: valid.length + invalid.length > MAX_RECIPIENTS };
}
