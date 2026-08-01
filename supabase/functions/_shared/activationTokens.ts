/**
 * AAC-owned activation tokens.
 *
 * Token format (opaque to the user, reproducible by the server):
 *
 *   v1.<activation_token_id>.<base64url(HMAC-SHA256(secret, canonical))>
 *
 * canonical = "v1|<id>|<user_id>|<expires_at_epoch_seconds>"
 *
 * Only integer epoch seconds are signed — never an ISO string — so the
 * Postgres round-trip (`date_trunc('second', ...)`) is lossless and the
 * worker can regenerate a byte-identical token on every retry.
 *
 * The plaintext token is NEVER persisted and NEVER queued. The database
 * stores only sha256(token).
 */

const enc = new TextEncoder();

export const ACTIVATION_TOKEN_TTL_DAYS = 7;

export interface ActivationTokenParts {
  id: string;
  userId: string;
  expiresAtEpoch: number;
}

export function activationCanonicalString(parts: ActivationTokenParts): string {
  return `v1|${parts.id}|${parts.userId}|${parts.expiresAtEpoch}`;
}

function base64UrlFromBytes(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function hex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

export async function signActivationToken(
  secret: string,
  parts: ActivationTokenParts,
): Promise<string> {
  if (!secret) throw new Error("ACTIVATION_TOKEN_SECRET is not configured");
  const key = await hmacKey(secret);
  const sig = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, enc.encode(activationCanonicalString(parts))),
  );
  return `v1.${parts.id}.${base64UrlFromBytes(sig)}`;
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(input));
  return hex(new Uint8Array(digest));
}

/** Structural parse only — no trust is implied. */
export function parseActivationToken(
  token: string | null | undefined,
): { id: string } | null {
  const raw = (token ?? "").trim();
  if (!raw || raw.length > 400) return null;
  const bits = raw.split(".");
  if (bits.length !== 3) return null;
  const [version, id, sig] = bits;
  if (version !== "v1") return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null;
  if (!/^[A-Za-z0-9_-]{20,}$/.test(sig)) return null;
  return { id };
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Recompute the token from the stored record and compare in constant time. */
export async function verifyActivationToken(
  secret: string,
  token: string,
  parts: ActivationTokenParts,
): Promise<boolean> {
  const expected = await signActivationToken(secret, parts);
  return timingSafeEqual(expected, token.trim());
}

export function epochSeconds(value: string | Date): number {
  const d = value instanceof Date ? value : new Date(value);
  return Math.floor(d.getTime() / 1000);
}

export function activationUrl(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/activate#t=${token}`;
}

/** Opaque single-use resend handle (never derived from the activation token). */
export function newResendHandle(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64UrlFromBytes(bytes);
}
