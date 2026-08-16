import { supabase } from "@/integrations/supabase/client";
import type { DevelopmentMediaRow } from "./types";

const MEDIA_BUCKET = "development-media";
const MEDIA_SIGNED_TTL_SECONDS = 60 * 60; // 1 hour for page session browsing

export function mediaDisplayUrl(
  media: Pick<DevelopmentMediaRow, "source_type" | "external_url" | "storage_path" | "id">,
  signedByPath: Map<string, string>,
): string | null {
  if (media.source_type === "external") {
    return media.external_url?.trim() || null;
  }
  if (media.storage_path) {
    return signedByPath.get(media.storage_path) ?? null;
  }
  return null;
}

export async function signDevelopmentMediaPaths(
  paths: Array<string | null | undefined>,
  expiresInSeconds = MEDIA_SIGNED_TTL_SECONDS,
): Promise<Map<string, string>> {
  const unique = Array.from(
    new Set(
      paths
        .map((p) => (typeof p === "string" ? p.trim() : ""))
        .filter(Boolean),
    ),
  );
  const map = new Map<string, string>();
  if (unique.length === 0) return map;

  const { data, error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .createSignedUrls(unique, expiresInSeconds);

  if (error || !data) {
    console.warn("[developments] createSignedUrls failed:", error?.message);
    return map;
  }

  for (const row of data) {
    if (row.path && row.signedUrl) map.set(row.path, row.signedUrl);
  }
  return map;
}

export async function resolveMediaUrlMap(
  media: DevelopmentMediaRow[],
): Promise<Record<string, string>> {
  const signed = await signDevelopmentMediaPaths(media.map((m) => m.storage_path));
  const out: Record<string, string> = {};
  for (const item of media) {
    const url = mediaDisplayUrl(item, signed);
    if (url) out[item.id] = url;
  }
  return out;
}
