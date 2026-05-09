/* ------------------------------------------------------------------ */
/*  Shared tracking + unsubscribe utilities                            */
/* ------------------------------------------------------------------ */

const FUNCTIONS_BASE = (() => {
  const url = Deno.env.get("SUPABASE_URL") || "";
  return url ? `${url.replace(/\/+$/, "")}/functions/v1` : "";
})();

export const MARKETING_CATEGORIES = new Set([
  "listing_shares",
  "hot_sheet_alerts",
  "marketing",
]);

export interface TrackingContext {
  jobId: string;
  recipientEmail: string;
  category: string;
}

function b64url(input: ArrayBuffer | Uint8Array | string): string {
  let bytes: Uint8Array;
  if (typeof input === "string") {
    bytes = new TextEncoder().encode(input);
  } else if (input instanceof Uint8Array) {
    bytes = input;
  } else {
    bytes = new Uint8Array(input);
  }
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function b64urlDecode(s: string): string {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const norm = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return atob(norm);
}

async function hmac(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return b64url(sig);
}

function getSecret(): string {
  return Deno.env.get("EMAIL_UNSUB_SECRET") || "dev-fallback-not-secure";
}

export async function signOpen(ctx: TrackingContext): Promise<string> {
  return hmac(getSecret(), `open:${ctx.jobId}:${ctx.recipientEmail.toLowerCase()}`);
}
export async function signClick(ctx: TrackingContext, targetUrl: string): Promise<string> {
  return hmac(getSecret(), `click:${ctx.jobId}:${ctx.recipientEmail.toLowerCase()}:${targetUrl}`);
}
export async function signUnsub(email: string, category: string): Promise<string> {
  return hmac(getSecret(), `unsub:${email.toLowerCase()}:${category}`);
}

export async function verifyOpen(ctx: TrackingContext, token: string): Promise<boolean> {
  return safeEq(token, await signOpen(ctx));
}
export async function verifyClick(ctx: TrackingContext, targetUrl: string, token: string): Promise<boolean> {
  return safeEq(token, await signClick(ctx, targetUrl));
}
export async function verifyUnsub(email: string, category: string, token: string): Promise<boolean> {
  return safeEq(token, await signUnsub(email, category));
}

function safeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function buildOpenPixelUrl(ctx: TrackingContext): Promise<string> {
  const t = await signOpen(ctx);
  const r = b64url(ctx.recipientEmail.toLowerCase());
  return `${FUNCTIONS_BASE}/track-email-open?j=${encodeURIComponent(ctx.jobId)}&r=${r}&t=${t}`;
}

export async function buildClickUrl(ctx: TrackingContext, targetUrl: string): Promise<string> {
  const t = await signClick(ctx, targetUrl);
  const r = b64url(ctx.recipientEmail.toLowerCase());
  const u = encodeURIComponent(targetUrl);
  return `${FUNCTIONS_BASE}/track-email-click?j=${encodeURIComponent(ctx.jobId)}&r=${r}&u=${u}&t=${t}`;
}

export async function buildUnsubUrl(email: string, category: string): Promise<string> {
  const t = await signUnsub(email, category);
  const e = b64url(email.toLowerCase());
  return `${FUNCTIONS_BASE}/email-unsubscribe?e=${e}&c=${encodeURIComponent(category)}&t=${t}`;
}

export function isMarketingCategory(category?: string | null): boolean {
  return !!category && MARKETING_CATEGORIES.has(category);
}
