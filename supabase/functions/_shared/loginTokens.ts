/**
 * AAC-owned login-link tokens.
 *
 * Token format:  l1.<login_token_id>.<base64url(HMAC-SHA256(secret, canonical))>
 * canonical   =  "l1|<id>|<user_id>|<expires_at_epoch_seconds>"
 *
 * The "l1" domain prefix keeps these signatures disjoint from activation
 * tokens even though both use ACTIVATION_TOKEN_SECRET — an activation token
 * can never validate as a login token, or vice versa.
 *
 * The plaintext token is NEVER persisted and NEVER queued. The database
 * stores only sha256(token); the worker re-derives the token at send time.
 */

const enc = new TextEncoder();

export const LOGIN_TOKEN_TTL_DAYS = 30;

export interface LoginTokenParts {
  id: string;
  userId: string;
  expiresAtEpoch: number;
}

export function loginCanonicalString(parts: LoginTokenParts): string {
  return `l1|${parts.id}|${parts.userId}|${parts.expiresAtEpoch}`;
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

export async function signLoginToken(
  secret: string,
  parts: LoginTokenParts,
): Promise<string> {
  if (!secret) throw new Error("ACTIVATION_TOKEN_SECRET is not configured");
  const key = await hmacKey(secret);
  const sig = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, enc.encode(loginCanonicalString(parts))),
  );
  return `l1.${parts.id}.${base64UrlFromBytes(sig)}`;
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(input));
  return hex(new Uint8Array(digest));
}

/** Structural parse only — no trust is implied. */
export function parseLoginToken(token: string | null | undefined): { id: string } | null {
  const raw = (token ?? "").trim();
  if (!raw || raw.length > 400) return null;
  const bits = raw.split(".");
  if (bits.length !== 3) return null;
  const [version, id, sig] = bits;
  if (version !== "l1") return null;
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
export async function verifyLoginToken(
  secret: string,
  token: string,
  parts: LoginTokenParts,
): Promise<boolean> {
  const expected = await signLoginToken(secret, parts);
  return timingSafeEqual(expected, token.trim());
}

export function epochSeconds(value: string | Date): number {
  const d = value instanceof Date ? value : new Date(value);
  return Math.floor(d.getTime() / 1000);
}

export function loginLinkUrl(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/signin-link#t=${token}`;
}
