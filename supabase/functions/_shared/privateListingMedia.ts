/** Resolve stored references to local private objects. Never fetch supplied URLs. */
export const PRIVATE_MEDIA_TTL = 600;
export const CONFIDENTIAL_BUCKETS = new Set([
  "listing-photos", "listing-floorplans", "listing-documents", "agent-match-photos", "email-attachments",
]);

export function privateStorageObject(value: unknown, fallbackBucket: string, supabaseUrl: string): { bucket: string; path: string } | null {
  const record = value && typeof value === "object" ? value as Record<string, unknown> : null;
  const raw = typeof value === "string" ? value : record?.url ?? record?.publicUrl ?? record?.path ?? record?.src ?? record?.image_url;
  if (typeof raw !== "string" || !raw.trim()) return null;
  let path = raw.trim();
  if (/^(?:data|blob|aac-private):/i.test(path) || path.startsWith("/")) return null;
  let bucket = fallbackBucket;
  if (/^https?:\/\//i.test(path)) {
    let url: URL;
    try { url = new URL(path); } catch { return null; }
    let localHost: string;
    try { localHost = new URL(supabaseUrl).hostname; } catch { return null; }
    const hosts = new Set([localHost, "cdn.allagentconnect.com", "qocduqtfbsevnhlgsfka.supabase.co"]);
    if (!hosts.has(url.hostname) || url.username || url.password || url.protocol !== "https:") return null;
    const match = url.pathname.match(/^\/storage\/v1\/(?:object|render\/image)\/(?:public|sign|authenticated)\/([^/]+)\/(.+)$/);
    if (!match) return null;
    bucket = match[1];
    try { path = decodeURIComponent(match[2]); } catch { return null; }
  } else {
    path = path.replace(/^\/+/, "");
    if (path.startsWith(`${fallbackBucket}/`)) path = path.slice(fallbackBucket.length + 1);
  }
  if (!CONFIDENTIAL_BUCKETS.has(bucket) || !path || path.includes("\\") || /[\u0000-\u001f]/.test(path)
    || path.split("/").some(part => !part || part === "." || part === "..")) return null;
  return { bucket, path };
}
